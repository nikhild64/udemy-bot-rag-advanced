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
  allCitations?: Citation[];
}

export function CitationCard({ citation, index, allCitations }: CitationCardProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const openViewer = () => setViewerOpen(true);

  const title = citation.sourceTitle || citation.sourceName || citation.title || `Source ${index + 1}`;
  const rawExcerpt = citation.excerpt || citation.content || citation.snippet || '';
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

  const score = citation.score ?? citation.similarityScore;
  const scorePercentage = score !== undefined ? Math.round(score * 100) : null;

  return (
    <div
      className="group cursor-pointer rounded-lg border border-border/70 bg-card/70 p-2 sm:p-2.5 text-xs shadow-2xs transition-all hover:border-primary/50 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex flex-col gap-1"
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
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-5 min-w-[20px] px-1 items-center justify-center rounded bg-primary/10 text-[10px] font-bold font-mono text-primary shrink-0">
            {index + 1}
          </div>
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-semibold text-foreground text-[11px] sm:text-xs">{title}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {page !== undefined && (
            <Badge variant="secondary" className="h-4.5 gap-0.5 px-1 font-mono text-[9px]">
              <BookOpen className="w-2.5 h-2.5" />
              <span>P.{page}</span>
            </Badge>
          )}

          {displayTimestamp && (
            <Badge variant="secondary" className="h-4.5 gap-0.5 px-1 font-mono text-[9px]">
              <Clock className="w-2.5 h-2.5" />
              <span>{displayTimestamp}</span>
            </Badge>
          )}

          <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all shrink-0" />
        </div>
      </div>

      {excerpt && (
        <p className="line-clamp-1 text-[11px] text-muted-foreground leading-tight font-sans pl-6">
          “{excerpt}”
        </p>
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
        <SourceViewer citation={{ ...citation, timestamp, excerpt }} citations={allCitations} />
      </Dialog>
    </div>
  );
}
