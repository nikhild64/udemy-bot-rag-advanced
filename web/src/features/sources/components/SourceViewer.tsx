"use client"

import { useEffect, useState } from 'react';
import { Citation } from '@/shared/types';
import { sourcesApi } from '../api/sources.api';
import { Loader2, AlertCircle, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SourceViewerProps {
  citation?: Citation;
  sourceId?: string;
}

export function SourceViewer({ citation, sourceId }: SourceViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewData, setViewData] = useState<any>(null);

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

  const timestamp = citation?.timestamp; // like '00:15:30'
  const getSeconds = (ts?: string) => {
    if (!ts) return 0;
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };
  
  const startSeconds = getSeconds(timestamp);

  // Embedded view based on type
  return (
    <div className="flex flex-col h-[70vh] max-h-[800px] bg-background">
      {/* Header bar */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between shrink-0 bg-muted/10">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-semibold text-sm line-clamp-1">{viewData.displayName}</h3>
          {citation?.page !== undefined && <span className="text-xs text-muted-foreground">Page {citation.page}</span>}
          {timestamp && <span className="text-xs text-muted-foreground">Timestamp: {timestamp}</span>}
        </div>
        
        {url && !videoId && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-2 shrink-0" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
            <ExternalLink className="w-3.5 h-3.5" />
            Open Original
          </Button>
        )}
      </div>

      {/* Viewer Content */}
      <div className="flex-1 overflow-auto bg-muted/5 relative">
        {videoId ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/90">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?start=${startSeconds}&autoplay=1`}
              title={viewData.displayName}
              className="w-full h-full max-w-4xl max-h-[600px] rounded-lg shadow-2xl border border-white/10"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : type === 'PDF' && url ? (
          <div className="h-full w-full">
            {/* simple iframe for PDF, appending #page=X if page is available */}
            <iframe 
              src={`${url}${citation?.page ? `#page=${citation.page}` : ''}`} 
              className="w-full h-full border-0 bg-white"
              title="PDF Viewer"
            />
          </div>
        ) : type === 'WEBSITE' && url ? (
          <div className="h-full w-full bg-white relative">
             <iframe 
              src={url} 
              className="w-full h-full border-0"
              title="Website Preview"
            />
          </div>
        ) : rawText ? (
          <div className="p-6 max-w-3xl mx-auto">
            <div className="prose prose-sm dark:prose-invert max-w-none font-mono text-[13px] whitespace-pre-wrap leading-relaxed">
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
      {citation?.excerpt && !videoId && (
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
