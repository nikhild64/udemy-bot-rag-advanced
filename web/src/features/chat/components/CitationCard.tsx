"use client"

import { useState } from 'react';
import { Citation } from '@/shared/types';
import { FileText, BookOpen, Clock, ExternalLink, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { SourceViewer } from '../../sources/components/SourceViewer';
import { Button } from '@/components/ui/button';

interface CitationCardProps {
  citation: Citation;
  index: number;
}

export function CitationCard({ citation, index }: CitationCardProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const openViewer = () => setViewerOpen(true);

  const title = citation.sourceTitle || citation.title || `Source ${index + 1}`;
  const rawExcerpt = citation.excerpt || citation.content || '';
  const page = citation.pageNumber || citation.page;
  
  // Extract timestamp from timestamp property, startTime, start_time, or rawExcerpt
  let extractedTimestamp: string | number | undefined =
    citation.timestamp || citation.startTime;

  if (!extractedTimestamp && rawExcerpt) {
    const tsMatch = rawExcerpt.match(/(?:\[)?(\d{1,2}:\d{2}(?::\d{2})?)(?:\])?/);
    if (tsMatch && tsMatch[1]) {
      extractedTimestamp = tsMatch[1];
    }
  }

  const excerpt = rawExcerpt;
  const timestamp = extractedTimestamp;

  const displayTimestamp = timestamp !== undefined && timestamp !== null ? (
    typeof timestamp === 'number'
      ? (timestamp >= 3600
          ? new Date(timestamp * 1000).toISOString().substring(11, 19)
          : new Date(timestamp * 1000).toISOString().substring(14, 19))
      : String(timestamp)
  ) : null;

  const scorePercentage = citation.score !== undefined ? Math.round(citation.score * 100) : null;

  return (
    <div
      className="group cursor-pointer rounded-xl border border-border/80 bg-card/80 p-3 text-xs shadow-2xs transition-colors hover:border-primary/50 hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      role="button"
      tabIndex={citation.sourceId ? 0 : undefined}
      aria-label={`Open citation ${index + 1}: ${title}`}
      onClick={citation.sourceId ? () => { if (!viewerOpen) openViewer(); } : undefined}
      onKeyDown={(event) => {
        if (citation.sourceId && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          if (!viewerOpen) openViewer();
        }
      }}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
          {index + 1}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium text-foreground">{title}</span>
            </div>
            {excerpt && (
              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                “{excerpt}”
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {page !== undefined && (
            <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 font-mono text-[10px]">
              <BookOpen className="w-2.5 h-2.5" />
              <span>P.{page}</span>
            </Badge>
          )}

          {displayTimestamp && (
            <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 font-mono text-[10px]">
              <Clock className="w-2.5 h-2.5" />
              <span>{displayTimestamp}</span>
            </Badge>
          )}

          {scorePercentage !== null && (
            <Badge variant="outline" className="h-5 border-primary/20 bg-primary/5 px-1.5 text-[10px] text-primary">
              {scorePercentage}% match
            </Badge>
          )}
        </div>
      </div>

      {citation.sourceId && (
        <div className="mt-3 flex justify-end border-t border-border/50 pt-2">
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px] text-primary hover:bg-primary/10 hover:text-primary" onClick={(event) => { event.stopPropagation(); openViewer(); }}>
            <ExternalLink className="w-3 h-3" />
            Open source
            <ArrowUpRight className="h-3 w-3 opacity-70" />
          </Button>
        </div>
      )}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen} contentClassName="max-w-6xl overflow-hidden p-0">
        <div className="relative flex items-center justify-between border-b border-border/40 px-4 py-3" onClick={(event) => event.stopPropagation()}>
          <DialogTitle className="text-sm">Source viewer</DialogTitle>
          <span className="text-[11px] text-muted-foreground">{page ? `Page ${page}` : displayTimestamp || 'Cited passage'}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Close source viewer"
            onClick={(event) => {
              event.stopPropagation();
              setViewerOpen(false);
            }}
          >
            <span aria-hidden="true" className="text-lg leading-none">×</span>
          </Button>
        </div>
        <SourceViewer citation={{ ...citation, timestamp, excerpt }} />
      </Dialog>
    </div>
  );
}
