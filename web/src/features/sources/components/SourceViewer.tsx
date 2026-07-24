"use client"

import { useEffect, useState } from 'react';
import { Citation } from '@/shared/types';
import { sourcesApi } from '../api/sources.api';
import { Loader2, AlertCircle, ExternalLink, FileText, AlignLeft, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SourceViewerProps {
  citation?: Citation;
  sourceId?: string;
}

export function SourceViewer({ citation, sourceId }: SourceViewerProps) {
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

  // Sync mode when viewData loads
  useEffect(() => {
    if (viewData) {
      const extractVideoId = (urlStr?: string | null) => {
        if (!urlStr) return null;
        if (/^[a-zA-Z0-9_-]{11}$/.test(urlStr.trim())) return urlStr.trim();
        const match = urlStr.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        return match ? match[1] : null;
      };
      const vId = viewData.metadata?.videoId || extractVideoId(viewData.url || viewData.metadata?.url || viewData.metadata?.videoUrl);
      const isMedia = !!(vId || (viewData.type === 'PDF' && viewData.url) || (viewData.type === 'WEBSITE' && viewData.url));
      setActiveMode(isMedia ? 'media' : 'transcript');
    }
  }, [viewData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground h-[500px]">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading original source...</p>
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
  const hasMedia = !!(videoId || (type === 'PDF' && url) || (type === 'WEBSITE' && url));
  const hasText = !!rawText;

  const timestamp = citation?.timestamp; // like '00:15:30'
  const getSeconds = (ts?: string) => {
    if (!ts) return 0;
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };
  
  const startSeconds = getSeconds(timestamp);

  return (
    <div className="flex flex-col h-[70vh] max-h-[800px] bg-background">
      {/* Header bar */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between shrink-0 bg-muted/10 gap-2">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <h3 className="font-semibold text-sm line-clamp-1">{viewData.displayName}</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {citation?.page !== undefined && <span>Page {citation.page}</span>}
            {timestamp && <span>Timestamp: {timestamp}</span>}
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

        {url && !videoId && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-2 shrink-0" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
            <ExternalLink className="w-3.5 h-3.5" />
            Open Original
          </Button>
        )}
      </div>

      {/* Viewer Content */}
      <div className="flex-1 overflow-auto bg-muted/5 relative">
        {activeMode === 'media' && videoId ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/90">
            <iframe
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
        ) : activeMode === 'media' && type === 'WEBSITE' && url ? (
          <div className="h-full w-full bg-white relative">
             <iframe 
              src={url} 
              className="w-full h-full border-0"
              title="Website Preview"
            />
          </div>
        ) : rawText ? (
          <div className="p-6 max-w-3xl mx-auto">
            <div className="prose prose-sm dark:prose-invert max-w-none font-mono text-[13px] whitespace-pre-wrap leading-relaxed bg-card p-6 rounded-xl border border-border shadow-xs">
              {rawText}
            </div>
          </div>
        ) : (
           <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center space-y-3">
             <div className="bg-primary/5 p-4 rounded-full">
               <FileText className="w-8 h-8 text-primary/40" />
             </div>
             <p className="text-sm max-w-sm">
               Preview is not available for this source type within the viewer. 
               <br />Please download or open the original file.
             </p>
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
