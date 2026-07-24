"use client"

import { useEffect, useState, useRef } from 'react';
import { Citation } from '@/shared/types';
import { sourcesApi } from '../api/sources.api';
import { Loader2, AlertCircle, ExternalLink, FileText, AlignLeft, Video, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PdfHighlightViewer } from './PdfHighlightViewer';

interface SourceViewerProps {
  citation?: Citation;
  citations?: Citation[];
  sourceId?: string;
  timestamp?: string | number;
  className?: string;
}

export function parseTimestampToSeconds(ts?: string | number | null): number {
  if (ts === undefined || ts === null || ts === '') return 0;
  
  if (typeof ts === 'number') {
    return isNaN(ts) || ts < 0 ? 0 : Math.floor(ts);
  }

  const str = String(ts).trim();
  if (!str) return 0;

  // Raw seconds like "135" or "135s" or "135.5"
  if (/^\d+(\.\d+)?s?$/i.test(str)) {
    const parsed = parseFloat(str.replace(/s$/i, ''));
    return isNaN(parsed) || parsed < 0 ? 0 : Math.floor(parsed);
  }

  // HMS format like "1h2m15s" or "2m15s" or "15s"
  const hmsMatch = str.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/i);
  if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
    const hours = parseInt(hmsMatch[1] || '0', 10);
    const minutes = parseInt(hmsMatch[2] || '0', 10);
    const seconds = parseInt(hmsMatch[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Remove brackets e.g. "[02:15]" -> "02:15"
  const cleaned = str.replace(/[\[\]]/g, '').trim();

  // Take start time if range like "02:15 - 03:00" or "02:15 → 03:00" or "02:15 to 03:00"
  const firstPart = cleaned.split(/[\s\-→\u2192to]+/)[0]?.trim() || '';

  const parts = firstPart.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1 && !isNaN(parts[0])) {
    return parts[0];
  }

  return 0;
}

export interface ExcerptMatch {
  start: number;
  end: number;
  matchedText: string;
}

export function findExcerptMatch(excerpt?: string | null, sourceText?: string | null): ExcerptMatch | null {
  if (!excerpt || !sourceText) return null;

  // 1. Clean the excerpt (strip leading timestamps e.g. [01:23], quotes, etc.)
  let cleanExcerpt = excerpt.trim();
  
  // Remove leading bracketed timestamps like "[01:23] " or "[01:23 - 02:45] " or "01:23 "
  cleanExcerpt = cleanExcerpt.replace(/^(?:\[?\d{1,2}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?\]?\s*)*/i, '');
  
  // Remove leading/trailing quotation marks if present
  cleanExcerpt = cleanExcerpt.replace(/^[“"']|[”"']$/g, '').trim();

  if (!cleanExcerpt || cleanExcerpt.length < 3) return null;

  // Attempt 1: Direct case-insensitive match
  const exactStart = sourceText.toLowerCase().indexOf(cleanExcerpt.toLowerCase());
  if (exactStart >= 0) {
    return {
      start: exactStart,
      end: exactStart + cleanExcerpt.length,
      matchedText: sourceText.slice(exactStart, exactStart + cleanExcerpt.length),
    };
  }

  // Attempt 2: Normalized whitespace & smart quotes mapping match
  const normalizedChars: string[] = [];
  const posMap: number[] = [];
  const endPosMap: number[] = [];
  let inSpace = false;

  for (let i = 0; i < sourceText.length; i++) {
    const char = sourceText[i];
    const isSpace = /\s/.test(char);
    const normChar = char.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

    if (isSpace) {
      if (!inSpace) {
        inSpace = true;
        normalizedChars.push(' ');
        posMap.push(i);
        endPosMap.push(i + 1);
      } else {
        endPosMap[endPosMap.length - 1] = i + 1;
      }
    } else {
      inSpace = false;
      normalizedChars.push(normChar);
      posMap.push(i);
      endPosMap.push(i + 1);
    }
  }

  const normalizedSource = normalizedChars.join('');
  const normalizedExcerpt = cleanExcerpt
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();

  const normStart = normalizedSource.toLowerCase().indexOf(normalizedExcerpt.toLowerCase());
  if (normStart >= 0) {
    const start = posMap[normStart];
    const lastNormIdx = normStart + normalizedExcerpt.length - 1;
    const end = endPosMap[lastNormIdx];
    return {
      start,
      end,
      matchedText: sourceText.slice(start, end),
    };
  }

  // Attempt 3: Sentence / Clause fuzzy matching (if excerpt has line breaks or added punctuation)
  const clauses = normalizedExcerpt
    .split(/(?:[\.\?\!\n]\s*)+/)
    .map(c => c.trim())
    .filter(c => c.length >= 12);

  for (const clause of clauses) {
    const clauseStart = normalizedSource.toLowerCase().indexOf(clause.toLowerCase());
    if (clauseStart >= 0) {
      const start = posMap[clauseStart];
      const lastNormIdx = clauseStart + clause.length - 1;
      const end = endPosMap[lastNormIdx];
      return {
        start,
        end,
        matchedText: sourceText.slice(start, end),
      };
    }
  }

  // Attempt 4: N-gram word sequence match (first 6-10 words)
  const words = normalizedExcerpt.split(' ').filter(w => w.length > 0);
  if (words.length >= 4) {
    const nGramLength = Math.min(8, words.length);
    const wordSequence = words.slice(0, nGramLength).join(' ');
    const seqStart = normalizedSource.toLowerCase().indexOf(wordSequence.toLowerCase());
    if (seqStart >= 0) {
      const start = posMap[seqStart];
      const lastNormIdx = Math.min(normalizedSource.length - 1, seqStart + normalizedExcerpt.length - 1);
      const end = endPosMap[lastNormIdx];
      return {
        start,
        end,
        matchedText: sourceText.slice(start, end),
      };
    }
  }

  return null;
}

export function SourceViewer({ citation, citations, sourceId, timestamp, className }: SourceViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewData, setViewData] = useState<any>(null);
  const [activeMode, setActiveMode] = useState<'media' | 'transcript'>('media');
  const [modeInitialized, setModeInitialized] = useState(false);
  const highlightRef = useRef<HTMLElement | null>(null);

  // Consolidate citation list
  const citationList = citations && citations.length > 0 ? citations : (citation ? [citation] : []);
  const [activeCitation, setActiveCitation] = useState<Citation | undefined>(citation || citationList[0]);

  useEffect(() => {
    if (citation) {
      setActiveCitation(citation);
    } else if (citations && citations.length > 0) {
      setActiveCitation(citations[0]);
    }
  }, [citation, citations]);

  const activeSourceId = activeCitation?.sourceId || sourceId;

  useEffect(() => {
    async function loadData() {
      if (!activeSourceId) {
        setError("No source ID available.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await sourcesApi.viewSource(activeSourceId);
        setViewData(data);
      } catch (err: any) {
        setError(err.message || "Failed to load source viewer data.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeSourceId]);

  // Sync mode only on initial load (preserve user selected activeMode across citation clicks)
  useEffect(() => {
    if (viewData && !modeInitialized) {
      const extractVideoId = (urlStr?: string | null) => {
        if (!urlStr) return null;
        if (/^[a-zA-Z0-9_-]{11}$/.test(urlStr.trim())) return urlStr.trim();
        const match = urlStr.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        return match ? match[1] : null;
      };
      const vId = viewData.metadata?.videoId || extractVideoId(viewData.url || viewData.metadata?.url || viewData.metadata?.videoUrl);
      const isMedia = !!(vId || (viewData.type === 'PDF' && viewData.url));
      setActiveMode(isMedia ? 'media' : 'transcript');
      setModeInitialized(true);
    }
  }, [viewData, modeInitialized]);

  const currentCitation = activeCitation || citation;
  const rawExcerpt = currentCitation?.excerpt || currentCitation?.content || currentCitation?.snippet || (currentCitation as any)?.text || '';
  const rawText = viewData?.rawText || '';
  const match = rawExcerpt && rawText ? findExcerptMatch(rawExcerpt, rawText) : null;

  // Scroll to highlight when extracted text is displayed
  useEffect(() => {
    if (highlightRef.current && (activeMode === 'transcript' || !viewData?.url || viewData?.type !== 'PDF')) {
      const timer = setTimeout(() => {
        highlightRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [viewData, currentCitation, activeMode, match?.start]);

  if (loading && !viewData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground h-[500px]">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <p className="text-sm font-medium">Loading source content...</p>
      </div>
    );
  }

  if (error && !viewData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-destructive h-[500px] bg-destructive/5 rounded-lg border border-destructive/20 m-4">
        <AlertCircle className="w-8 h-8 mb-4 opacity-80" />
        <p className="font-medium text-sm">{error || "Data not found"}</p>
      </div>
    );
  }

  const { type, url, metadata } = viewData || {};
  const pageNumber = currentCitation?.pageNumber || currentCitation?.page;
  const isPdf = type === 'PDF' || viewData?.mimeType === 'application/pdf';

  const extractVideoId = (urlStr?: string | null) => {
    if (!urlStr) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(urlStr.trim())) return urlStr.trim();
    const match = urlStr.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  const videoId = metadata?.videoId || extractVideoId(url || metadata?.url || metadata?.videoUrl);
  const hasMedia = !!(videoId || (type === 'PDF' && url));

  const extractTimestampFromText = (text?: string): string | undefined => {
    if (!text) return undefined;
    const match = text.match(/(?:\[)?(\d{1,2}:\d{2}(?::\d{2})?)(?:\])?/);
    return match ? match[1] : undefined;
  };

  const extractTimeFromUrl = (urlStr?: string): string | undefined => {
    if (!urlStr) return undefined;
    const match = urlStr.match(/[?&](?:t|start)=(\d+(?:h|\d+m|\d+s)?|\d+:\d+(?::\d+)?)/i);
    return match ? match[1] : undefined;
  };

  const rawTimestamp =
    timestamp ||
    currentCitation?.timestamp ||
    currentCitation?.startTime ||
    (currentCitation as any)?.start_time ||
    extractTimestampFromText(rawExcerpt) ||
    extractTimeFromUrl(url || metadata?.url || metadata?.videoUrl);

  const startSeconds = parseTimestampToSeconds(rawTimestamp);

  const displayTimestamp = rawTimestamp !== undefined && rawTimestamp !== null ? (
    typeof rawTimestamp === 'number'
      ? (rawTimestamp >= 3600
          ? new Date(rawTimestamp * 1000).toISOString().substring(11, 19)
          : new Date(rawTimestamp * 1000).toISOString().substring(14, 19))
      : String(rawTimestamp)
  ) : null;

  const getDomainName = (rawUrl?: string) => {
    if (!rawUrl) return 'Website';
    try {
      return new URL(rawUrl).hostname.replace(/^www\./, '');
    } catch {
      return 'Website';
    }
  };

  const openOriginalWebsite = (targetUrl?: string) => {
    const link = targetUrl || url || metadata?.url;
    if (!link) return;
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const scrollToHighlight = () => {
    if (activeMode !== 'transcript') {
      setActiveMode('transcript');
    }
    setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  return (
    <div className={cn("flex flex-col h-[70vh] max-h-[800px] bg-background", className)}>
      {/* Header bar */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between shrink-0 bg-muted/10 gap-2">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <h3 className="font-semibold text-sm line-clamp-1">{viewData?.displayName || 'Loading...'}</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {type === 'WEBSITE' && <span>Source: {getDomainName(url || metadata?.url)}</span>}
            {pageNumber !== undefined && <span>Page {pageNumber}</span>}
            {displayTimestamp && <span>Timestamp: {displayTimestamp}</span>}
            {rawText && <span>{rawText.split(/\s+/).length} words</span>}
          </div>
        </div>

        {/* View Mode Toggle Switch */}
        {hasMedia && (
          <div className="flex items-center p-0.5 bg-muted/80 rounded-lg border border-border text-xs shrink-0">
            <button
              onClick={() => setActiveMode('media')}
              className={cn(
                "px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 cursor-pointer",
                activeMode === 'media'
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {videoId ? <Video className="w-3.5 h-3.5 text-blue-400" /> : <FileText className="w-3.5 h-3.5 text-red-400" />}
              <span>{videoId ? 'Video Player' : 'PDF View'}</span>
            </button>
            <button
              onClick={() => setActiveMode('transcript')}
              className={cn(
                "px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 cursor-pointer",
                activeMode === 'transcript'
                  ? "bg-background text-primary shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <AlignLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>{videoId ? 'Transcript' : 'Extracted Text'}</span>
            </button>
          </div>
        )}

        {(url || metadata?.url) && !videoId && type !== 'PDF' && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-2 shrink-0 border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => openOriginalWebsite(url || metadata?.url)}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Website</span>
          </Button>
        )}
      </div>

      {/* Viewer Content */}
      <div className="relative flex-1 min-h-0 overflow-hidden bg-muted/5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading document text...</p>
          </div>
        ) : activeMode === 'media' && videoId ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/90">
            <iframe
              key={`${videoId}-${startSeconds}`}
              src={`https://www.youtube.com/embed/${videoId}?start=${startSeconds}&autoplay=1`}
              title={viewData.displayName}
              className="w-full h-full max-w-4xl max-h-[600px] rounded-lg shadow-2xl border border-white/10"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : activeMode === 'media' && isPdf && url ? (
          <div className={cn("grid h-full min-h-0 grid-cols-1", citationList.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-1")}>
            <div className="h-full min-h-0 bg-muted/10">
              <PdfHighlightViewer
                key={`${url}-${pageNumber}-${rawExcerpt}`}
                url={url}
                pageNumber={pageNumber}
                excerpt={rawExcerpt}
                displayName={viewData?.displayName}
              />
            </div>
            {citationList.length > 0 && (
              <aside className="h-full min-h-0 flex flex-col border-t border-border/60 bg-card p-4 lg:border-l lg:border-t-0">
                <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Citations ({citationList.length})</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Select a citation to open doc</p>
                  </div>
                  <FileText className="h-4 w-4 text-primary/70" />
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                  {citationList.map((cit, idx) => {
                    const isSelected = cit === activeCitation || (cit.sourceId === activeCitation?.sourceId && (cit.excerpt === activeCitation?.excerpt || cit.pageNumber === activeCitation?.pageNumber || cit.page === activeCitation?.page));
                    const citExcerpt = cit.excerpt || cit.content || cit.snippet || (cit as any).text || '';
                    const citTitle = cit.sourceTitle || cit.sourceName || cit.title || `Source ${idx + 1}`;
                    const citPage = cit.pageNumber || cit.page;
                    const citTime = cit.timestamp || cit.startTime;

                    return (
                      <button
                        key={idx}
                        onClick={() => setActiveCitation(cit)}
                        className={cn(
                          "group flex flex-col gap-1 p-2.5 rounded-xl border text-left transition-all cursor-pointer w-full",
                          isSelected
                            ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30 shadow-xs"
                            : "bg-background/80 border-border/60 hover:bg-muted/50 hover:border-border"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn("flex h-4 min-w-[18px] px-1 items-center justify-center rounded text-[10px] font-bold font-mono shrink-0", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-semibold truncate text-foreground">{citTitle}</span>
                          </div>
                          {citPage !== undefined && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded shrink-0">
                              P.{citPage}
                            </span>
                          )}
                          {citPage === undefined && citTime !== undefined && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded shrink-0">
                              {citTime}
                            </span>
                          )}
                        </div>
                        {citExcerpt && (
                          <p className="text-[11px] leading-snug text-muted-foreground line-clamp-2 font-sans opacity-90">
                            “{citExcerpt}”
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}
          </div>
        ) : rawText ? (
          <div className={cn("grid h-full min-h-0 grid-cols-1", citationList.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-1")}>
            <div className="h-full min-h-0 overflow-y-auto min-w-0 bg-background p-6 sm:p-8">
              <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                  {type === 'WEBSITE' ? 'Extracted Web Content' : type === 'PDF' ? 'Extracted Document Text' : ['YOUTUBE', 'VIDEO', 'AUDIO', 'VTT'].includes(type) ? 'Transcript' : 'Extracted Content'}
                </span>
                <span className="text-xs text-muted-foreground">{rawText.split(/\s+/).length} words</span>
              </div>
              <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground selection:bg-primary/20">
                {match ? (
                  <>
                    {rawText.slice(0, match.start)}
                    <mark
                      ref={highlightRef}
                      id="cited-passage-highlight"
                      className="bg-amber-300/60 dark:bg-amber-400/40 text-foreground px-1 py-0.5 rounded font-medium scroll-mt-24"
                    >
                      {match.matchedText}
                    </mark>
                    {rawText.slice(match.end)}
                  </>
                ) : (
                  rawText
                )}
              </div>
            </div>
            {citationList.length > 0 && (
              <aside className="h-full min-h-0 flex flex-col border-t border-border/60 bg-card p-4 lg:border-l lg:border-t-0">
                <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Citations ({citationList.length})</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Select a citation to open doc</p>
                  </div>
                  <FileText className="h-4 w-4 text-primary/70" />
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                  {citationList.map((cit, idx) => {
                    const isSelected = cit === activeCitation || (cit.sourceId === activeCitation?.sourceId && (cit.excerpt === activeCitation?.excerpt || cit.pageNumber === activeCitation?.pageNumber || cit.page === activeCitation?.page));
                    const citExcerpt = cit.excerpt || cit.content || cit.snippet || (cit as any).text || '';
                    const citTitle = cit.sourceTitle || cit.sourceName || cit.title || `Source ${idx + 1}`;
                    const citPage = cit.pageNumber || cit.page;
                    const citTime = cit.timestamp || cit.startTime;

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setActiveCitation(cit);
                          setTimeout(() => {
                            highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 150);
                        }}
                        className={cn(
                          "group flex flex-col gap-1 p-2.5 rounded-xl border text-left transition-all cursor-pointer w-full",
                          isSelected
                            ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30 shadow-xs"
                            : "bg-background/80 border-border/60 hover:bg-muted/50 hover:border-border"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn("flex h-4 min-w-[18px] px-1 items-center justify-center rounded text-[10px] font-bold font-mono shrink-0", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-semibold truncate text-foreground">{citTitle}</span>
                          </div>
                          {citPage !== undefined && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded shrink-0">
                              P.{citPage}
                            </span>
                          )}
                          {citPage === undefined && citTime !== undefined && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded shrink-0">
                              {citTime}
                            </span>
                          )}
                        </div>
                        {citExcerpt && (
                          <p className="text-[11px] leading-snug text-muted-foreground line-clamp-2 font-sans opacity-90">
                            “{citExcerpt}”
                          </p>
                        )}
                        {isSelected && match && (
                          <div className="mt-1 flex items-center justify-between border-t border-primary/20 pt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Passage Highlighted
                            </span>
                            <span className="underline opacity-80 group-hover:opacity-100">Scroll to view →</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center space-y-3">
            <div className="bg-primary/5 p-4 rounded-full">
              <FileText className="w-8 h-8 text-primary/40" />
            </div>
            <p className="text-sm max-w-sm">
              Preview is not available for this source type within the viewer. 
              <br />Please open the original link.
            </p>
            {(url || metadata?.url) && type !== 'PDF' && (
              <Button size="sm" className="gap-2" onClick={() => openOriginalWebsite(url || metadata?.url)}>
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Visit Original Website</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Snippet Highlight (if available and not playing video) */}
      {citation?.excerpt && activeMode !== 'media' && !rawText && (
        <div className="border-t border-border/60 bg-muted/20 p-4 shrink-0 shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.1)] z-10">
          <p className="text-xs font-semibold mb-2 text-primary uppercase tracking-wider">Cited Excerpt</p>
          <div className="text-[13px] text-muted-foreground font-mono bg-background border border-border p-3 rounded-md max-h-32 overflow-y-auto">
            {citation.excerpt}
          </div>
        </div>
      )}
    </div>
  );
}

function highlightExcerpt(excerpt: string, sourceText: string) {
  const match = findExcerptMatch(excerpt, sourceText);
  if (!match) return excerpt || 'No excerpt was returned for this citation.';

  const start = match.start;
  const matchEnd = match.end;
  return (
    <>
      {sourceText.slice(Math.max(0, start - 180), start)}
      <mark className="rounded bg-amber-500/35 px-1.5 py-0.5 text-foreground decoration-amber-500 font-semibold underline-offset-2">
        {sourceText.slice(start, matchEnd)}
      </mark>
      {sourceText.slice(matchEnd, matchEnd + 180)}
    </>
  );
}

