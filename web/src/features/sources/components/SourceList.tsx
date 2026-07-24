"use client"

import { useState } from 'react';
import { useSourcesQuery } from '../hooks/useSources';
import { useUIStore } from '@/shared/lib/store';
import { SourceItem } from './SourceItem';
import { SourceViewerDialog } from './SourceViewerDialog';
import { Upload, FilePlus, FolderKanban, Sparkles, Radio, GitCommit, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function SourceList() {
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const setUploadModalOpen = useUIStore((s) => s.setUploadModalOpen);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState('');

  const { data: sources, isLoading, isError, error } = useSourcesQuery(activeNotebookId);

  const handleOpenViewer = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    setViewerOpen(true);
  };

  const handleQuickAction = (_actionType: 'podcast' | 'timeline') => {
    // Do nothing for now as requested
  };

  const hasSources = !!(sources && sources.length > 0);
  const hasReadySources = hasSources && sources.some((s) => s.status === 'Ready' || (s.status as string) === 'Indexed');

  if (!activeNotebookId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground space-y-3">
        <FolderKanban className="w-10 h-10 text-muted-foreground/40 stroke-1" />
        <p className="text-xs">Select or create a notebook to view and manage knowledge sources.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-3 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sources {sources ? `(${sources.length})` : ''}
          </h3>
        </div>
        {hasSources && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex items-center gap-1.5 border-dashed border-primary/40 hover:border-primary text-primary"
            onClick={() => setUploadModalOpen(true)}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Add Source</span>
          </Button>
        )}
      </div>

      {/* Sources List */}
      <div className="shrink-0 max-h-[55%] overflow-y-auto space-y-2 pr-1">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div className="p-3 text-xs text-destructive bg-destructive/10 rounded-lg">
            Failed to load sources: {(error as any)?.message || 'Unknown error'}
          </div>
        ) : sources && sources.length > 0 ? (
          sources.map((source) => (
            <SourceItem 
              key={source.id} 
              source={source} 
              notebookId={activeNotebookId} 
              onOpenViewer={handleOpenViewer}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-xl text-center space-y-3 bg-muted/20">
            <FilePlus className="w-8 h-8 text-muted-foreground/50 stroke-1" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">No sources added yet</p>
              <p className="text-[11px] text-muted-foreground max-w-[200px]">
                Upload PDFs, Markdown documents, audio/video files, or web links to train your AI.
              </p>
            </div>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setUploadModalOpen(true)}>
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Knowledge Source</span>
            </Button>
          </div>
        )}
      </div>

      {/* Quick Actions Section (Positioned directly below sources) */}
      {hasReadySources && (
        <div className="pt-3 border-t border-border/60 space-y-2.5 shrink-0 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between px-1 shrink-0">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick Actions</span>
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-0.5">
            {/* Audio Podcast Tile */}
            <button
              onClick={() => handleQuickAction('podcast')}
              className="group relative flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card/40 hover:bg-card/90 hover:border-amber-500/50 transition-all duration-200 text-left shadow-xs hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-black transition-colors shrink-0">
                <Radio className="w-4 h-4 stroke-[2]" />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground group-hover:text-amber-500 transition-colors flex items-center justify-between">
                  <span>Audio Podcast</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-amber-500" />
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                  Synthesize an interactive AI audio episode summarizing key concepts
                </p>
              </div>
            </button>

            {/* Learning Timeline Tile */}
            <button
              onClick={() => handleQuickAction('timeline')}
              className="group relative flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card/40 hover:bg-card/90 hover:border-cyan-500/50 transition-all duration-200 text-left shadow-xs hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black transition-colors shrink-0">
                <GitCommit className="w-4 h-4 stroke-[2]" />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground group-hover:text-cyan-400 transition-colors flex items-center justify-between">
                  <span>Learning Timeline</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-cyan-400" />
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                  Generate a step-by-step chronological roadmap from your sources
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Source Viewer Dialog for Notebook Sources */}
      {sources && (
        <SourceViewerDialog
          key={selectedSourceId || 'default'}
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          sources={sources}
          initialSourceId={selectedSourceId}
        />
      )}
    </div>
  );
}

