"use client"

import { useEffect, useState } from 'react';
import { Citation } from '@/shared/types';
import { sourcesApi } from '../api/sources.api';
import { Loader2, AlertCircle, ExternalLink, FileText, AlignLeft, Video, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SourceViewerProps {
  citation?: Citation;
  sourceId?: string;
  timestamp?: string | number;
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

export function SourceViewer({ citation, sourceId, timestamp }: SourceViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewData, setViewData] = useState<any>(null);
  const [activeMode, setActiveMode] = useState<'media' | 'transcript'>('media');

  useEffect(() => {
    async function loadData() {
      const targetId = sourceId || citation?.sourceId;
      if (!targetId) {
        setError("No source ID available.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await sourcesApi.viewSource(targetId);
        setViewData(data);
      } catch (err: any) {
        setError(err.message || "Failed to load source viewer data.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [sourceId, citation?.sourceId]);

  // Sync mode when viewData loads (websites show extracted text directly)
  useEffect(() => {
    if (viewData) {
      const extractVideoId = (urlStr?: string | null) => {
        if (!urlStr) return null;
        if (/^[a-zA-Z0-9_-]{11}$/.test(urlStr.trim())) return urlStr.trim();
        const match = urlStr.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        return match ? match[1] : null;
      };
      const vId = viewData.metadata?.videoId || extractVideoId(viewData.url || viewData.metadata?.url || viewData.metadata?.videoUrl);
      const isMedia = !!(vId || (viewData.type === 'PDF' && viewData.url));
      setActiveMode(isMedia ? 'media' : 'transcript');
    }
  }, [viewData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground h-[500px]">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading source content...</p>
      </div>
    );
  }

  if (error || !viewData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-destructive h-[500px] bg-destructive/5 rounded-lg border border-destructive/20 m-4">
        <AlertCircle className="w-8 h-8 mb-4 opacity-80" />
        <p className="font-medium text-sm">{error || "Data not found"}</p>
      </div>
    );
  }

  const { type, url, rawText, metadata } = viewData;

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
    citation?.timestamp ||
    citation?.startTime ||
    (citation as any)?.start_time ||
    extractTimestampFromText(citation?.excerpt || citation?.content || (citation as any)?.text) ||
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

  return (
    <div className="flex flex-col h-[70vh] max-h-[800px] bg-background">
      {/* Header bar */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between shrink-0 bg-muted/10 gap-2">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <h3 className="font-semibold text-sm line-clamp-1">{viewData.displayName}</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {type === 'WEBSITE' && <span>Source: {getDomainName(url || metadata?.url)}</span>}
            {citation?.page !== undefined && <span>Page {citation.page}</span>}
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

        {(url || metadata?.url) && !videoId && (
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
      <div className="flex-1 overflow-auto bg-muted/5 relative">
        {activeMode === 'media' && videoId ? (
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
        ) : activeMode === 'media' && type === 'PDF' && url ? (
          <div className="h-full w-full">
            <iframe 
              src={`${url}${citation?.page ? `#page=${citation.page}` : ''}`} 
              className="w-full h-full border-0 bg-white"
              title="PDF Viewer"
            />
          </div>
        ) : rawText ? (
          <div className="p-6 max-w-4xl mx-auto w-full space-y-4">
            <div className="bg-card p-6 sm:p-8 rounded-xl border border-border shadow-xs space-y-4">
              <div className="border-b border-border/60 pb-3 flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-primary uppercase tracking-wider">
                  Extracted Web Content
                </span>
                <span className="text-xs text-muted-foreground">
                  {rawText.split(/\s+/).length} words
                </span>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none font-sans text-sm leading-relaxed text-foreground whitespace-pre-wrap selection:bg-primary/20">
                {rawText}
              </div>
            </div>
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
            {(url || metadata?.url) && (
              <Button size="sm" className="gap-2" onClick={() => openOriginalWebsite(url || metadata?.url)}>
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Visit Original Website</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Snippet Highlight (if available and not playing video) */}
      {citation?.excerpt && activeMode !== 'media' && (
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
