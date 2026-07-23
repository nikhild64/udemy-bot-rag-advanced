"use client"

import { useState } from 'react';
import { Citation } from '@/shared/types';
import { FileText, ChevronDown, ChevronUp, BookOpen, Clock, Layers, ExternalLink, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { SourceViewer } from '../../sources/components/SourceViewer';
import { Button } from '@/components/ui/button';

interface CitationCardProps {
  citation: Citation;
  index: number;
}

export function CitationCard({ citation, index }: CitationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const title = citation.sourceTitle || citation.title || `Source ${index + 1}`;
  const excerpt = citation.excerpt || citation.content || '';
  const page = citation.pageNumber || citation.page;
  const timestamp = citation.timestamp;

  const scorePercentage = citation.score !== undefined ? Math.round(citation.score * 100) : null;

  return (
    <div className="p-2.5 bg-card/80 border border-border/80 rounded-xl hover:border-primary/40 transition-all text-xs space-y-2 shadow-2xs">
      <div
        className="flex items-center justify-between cursor-pointer gap-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold shrink-0">
            [{index + 1}]
          </div>
          <span className="font-medium text-foreground truncate">{title}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {page !== undefined && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-mono">
              <BookOpen className="w-2.5 h-2.5" />
              <span>P.{page}</span>
            </Badge>
          )}

          {timestamp && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-mono">
              <Clock className="w-2.5 h-2.5" />
              <span>{timestamp}</span>
            </Badge>
          )}

          {scorePercentage !== null && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-primary/5 text-primary border-primary/20">
              {scorePercentage}% match
            </Badge>
          )}

          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Snippet display */}
      {excerpt && (
        <div
          className={cn(
            'text-muted-foreground text-[11px] leading-relaxed bg-muted/30 p-2 rounded-lg border border-border/40 font-mono',
            !expanded && 'line-clamp-2'
          )}
        >
          "{excerpt}"
        </div>
      )}

      {/* View Original Source Button */}
      {expanded && citation.sourceId && (
        <div className="pt-1 flex justify-end">
          <Button variant="secondary" size="sm" className="h-7 text-[10px] gap-1 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" onClick={() => setViewerOpen(true)}>
            <ExternalLink className="w-3 h-3" />
            View Original Source
          </Button>
          <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
            <div className="flex justify-between items-center px-4 py-2 border-b border-border/40">
              <DialogTitle className="text-sm">Source Viewer</DialogTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewerOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-0 overflow-hidden">
              <SourceViewer citation={citation} />
            </div>
          </Dialog>
        </div>
      )}
    </div>
  );
}
