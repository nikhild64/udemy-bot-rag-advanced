"use client"

import { useSourcesQuery } from '../hooks/useSources';
import { useUIStore } from '@/shared/lib/store';
import { SourceItem } from './SourceItem';
import { Upload, FilePlus, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function SourceList() {
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const setUploadModalOpen = useUIStore((s) => s.setUploadModalOpen);

  const { data: sources, isLoading, isError, error } = useSourcesQuery(activeNotebookId);

  if (!activeNotebookId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground space-y-3">
        <FolderKanban className="w-10 h-10 text-muted-foreground/40 stroke-1" />
        <p className="text-xs">Select or create a notebook to view and manage knowledge sources.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sources {sources ? `(${sources.length})` : ''}
          </h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs flex items-center gap-1.5 border-dashed border-primary/40 hover:border-primary text-primary"
          onClick={() => setUploadModalOpen(true)}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Add Source</span>
        </Button>
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
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
            <SourceItem key={source.id} source={source} notebookId={activeNotebookId} />
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
    </div>
  );
}
