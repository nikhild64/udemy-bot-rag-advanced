"use client"

import { useState } from 'react';
import { useSourcesQuery, useNotebookArtifactsQuery, useGeneratePodcastMutation, useGenerateLearningPathMutation, useReindexSourceMutation } from '../hooks/useSources';
import { useUIStore } from '@/shared/lib/store';
import { SourceItem } from './SourceItem';
import { SourceViewerDialog } from './SourceViewerDialog';
import { PodcastScriptDialog, PodcastScript } from './PodcastScriptDialog';
import { LearningPathDialog, LearningPath } from './LearningPathDialog';
import { Upload, FilePlus, FolderKanban, Sparkles, Radio, GitCommit, ChevronRight, Loader2, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function SourceList() {
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const setUploadModalOpen = useUIStore((s) => s.setUploadModalOpen);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | undefined>(undefined);

  // ── Dialog modal states ──
  const [podcastOpen, setPodcastOpen] = useState(false);
  const [learningPathOpen, setLearningPathOpen] = useState(false);

  const { data: sources, isLoading, isError, error } = useSourcesQuery(activeNotebookId);
  const { data: artifacts } = useNotebookArtifactsQuery(activeNotebookId);

  const podcastMutation = useGeneratePodcastMutation();
  const learningPathMutation = useGenerateLearningPathMutation();
  const reindexMutation = useReindexSourceMutation(activeNotebookId);

  const handleOpenViewer = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    setViewerOpen(true);
  };

  // Artifact states from DB
  const podcastArtifact = artifacts?.podcast;
  const podcastStatus = podcastArtifact?.status || 'IDLE';
  const podcastData = podcastArtifact?.data as PodcastScript | null;
  const isPodcastGenerating = podcastStatus === 'GENERATING' || podcastMutation.isPending;

  const pathArtifact = artifacts?.learningPath;
  const pathStatus = pathArtifact?.status || 'IDLE';
  const pathData = pathArtifact?.data as LearningPath | null;
  const isPathGenerating = pathStatus === 'GENERATING' || learningPathMutation.isPending;

  // ── Podcast Actions ──
  const handlePodcastClick = () => {
    if (!activeNotebookId) return;
    if (podcastStatus === 'READY' && podcastData) {
      setPodcastOpen(true);
    } else if (!isPodcastGenerating) {
      podcastMutation.mutate({ notebookId: activeNotebookId });
    }
  };

  const handlePodcastRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeNotebookId || isPodcastGenerating) return;
    podcastMutation.mutate({ notebookId: activeNotebookId, force: true });
  };

  // ── Learning Path Actions ──
  const handleLearningPathClick = () => {
    if (!activeNotebookId) return;
    if (pathStatus === 'READY' && pathData) {
      setLearningPathOpen(true);
    } else if (!isPathGenerating) {
      learningPathMutation.mutate({ notebookId: activeNotebookId });
    }
  };

  const handleLearningPathRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeNotebookId || isPathGenerating) return;
    learningPathMutation.mutate({ notebookId: activeNotebookId, force: true });
  };

  const handleSelectSourceFromPath = (sourceTitle: string, timestamp?: string) => {
    setLearningPathOpen(false);
    if (!sources || sources.length === 0) return;
    const search = sourceTitle.toLowerCase().trim();
    const match = sources.find((s) => {
      const t = (s.title || '').toLowerCase();
      const d = (s.displayName || '').toLowerCase();
      return t.includes(search) || d.includes(search) || search.includes(t) || search.includes(d);
    });

    if (match) {
      setSelectedSourceId(match.id);
    } else {
      setSelectedSourceId(sources[0].id);
    }
    setSelectedTimestamp(timestamp);
    setViewerOpen(true);
  };

  const hasSources = !!(sources && sources.length > 0);
  const hasReadySources = hasSources && sources.some((s) => s.status === 'Ready' || (s.status as string) === 'Indexed');
  const isAnySourceProcessing = sources?.some((s) => !['Ready', 'Indexed', 'Failed'].includes(s.status as string));
  const areAllSourcesReady = hasSources && !isAnySourceProcessing;

  const handleReindexAll = () => {
    if (!sources) return;
    for (const source of sources) {
      if (source.status === 'Ready' || (source.status as string) === 'Indexed' || source.status === 'Failed') {
        reindexMutation.mutate(source.id);
      }
    }
  };

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
        <div className="flex items-center gap-1.5">
          {hasSources && areAllSourcesReady && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs flex items-center gap-1 border-dashed text-muted-foreground hover:text-foreground"
              onClick={handleReindexAll}
              disabled={reindexMutation.isPending}
              title="Reindex All Sources"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reindexMutation.isPending ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {hasSources && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs flex items-center gap-1 border-dashed border-primary/40 hover:border-primary text-primary"
              onClick={() => setUploadModalOpen(true)}
              title="Add Source"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          )}
        </div>
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

      {/* Quick Actions Section */}
      {hasSources && (
        <div className="pt-3 border-t border-border/60 space-y-2.5 shrink-0 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between px-1 shrink-0">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick Actions</span>
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-0.5">
            {/* ── Audio Podcast Tile ── */}
            <PodcastTile
              status={podcastStatus}
              isGenerating={isPodcastGenerating}
              onClick={handlePodcastClick}
              onRefresh={handlePodcastRefresh}
              disabled={!areAllSourcesReady}
            />

            {/* ── Learning Timeline Tile ── */}
            <LearningTimelineTile
              status={pathStatus}
              isGenerating={isPathGenerating}
              onClick={handleLearningPathClick}
              onRefresh={handleLearningPathRefresh}
              disabled={!areAllSourcesReady}
            />
          </div>
        </div>
      )}

      {/* Source Viewer Dialog */}
      {sources && (
        <SourceViewerDialog
          key={`${selectedSourceId}-${selectedTimestamp || 'default'}`}
          isOpen={viewerOpen}
          onClose={() => {
            setViewerOpen(false);
            setSelectedTimestamp(undefined);
          }}
          sources={sources}
          initialSourceId={selectedSourceId}
          initialTimestamp={selectedTimestamp}
        />
      )}

      {/* Podcast Script Dialog */}
      <PodcastScriptDialog
        isOpen={podcastOpen}
        onClose={() => setPodcastOpen(false)}
        isGenerating={isPodcastGenerating}
        script={podcastData}
      />

      {/* Learning Path Dialog */}
      <LearningPathDialog
        isOpen={learningPathOpen}
        onClose={() => setLearningPathOpen(false)}
        isGenerating={isPathGenerating}
        learningPath={pathData}
        onSelectSource={handleSelectSourceFromPath}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Extracted tile sub-components
// ─────────────────────────────────────────────────────────────

function PodcastTile({
  status,
  isGenerating,
  onClick,
  onRefresh,
  disabled,
}: {
  status: string;
  isGenerating: boolean;
  onClick: () => void;
  onRefresh: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  const isDone = status === 'READY';
  const isFailed = status === 'FAILED';

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`group relative flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card/40 transition-all duration-200 text-left shadow-xs ${
        isGenerating ? 'opacity-80' : ''
      } ${
        disabled 
          ? 'opacity-50 cursor-not-allowed grayscale-[0.5]' 
          : 'hover:bg-card/90 hover:border-amber-500/50 hover:shadow-md cursor-pointer'
      }`}
    >
      <div className={`p-2 rounded-lg transition-colors shrink-0 ${
        disabled
          ? 'bg-muted text-muted-foreground'
          : isGenerating
          ? 'bg-amber-500/20 text-amber-400'
          : isDone
          ? 'bg-emerald-500/10 text-emerald-400'
          : isFailed
          ? 'bg-red-500/10 text-red-400'
          : 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-black'
      }`}>
        {isGenerating ? (
          <Loader2 className="w-4 h-4 stroke-[2] animate-spin" />
        ) : isDone ? (
          <CheckCircle className="w-4 h-4 stroke-[2]" />
        ) : isFailed ? (
          <AlertCircle className="w-4 h-4 stroke-[2]" />
        ) : (
          <Radio className="w-4 h-4 stroke-[2]" />
        )}
      </div>

      <div className="space-y-0.5 min-w-0 flex-1">
        <div className={`text-xs font-semibold transition-colors flex items-center justify-between ${
          isGenerating ? 'text-amber-400' : isDone ? 'text-emerald-400' : isFailed ? 'text-red-400' : 'text-foreground group-hover:text-amber-500'
        }`}>
          <span>
            {isGenerating ? 'Creating Podcast…' : isDone ? 'View Podcast' : isFailed ? 'Generation Failed' : 'Audio Podcast'}
          </span>

          <div className="flex items-center gap-1">
            {(isDone || isFailed) && !disabled && (
              <button
                type="button"
                onClick={onRefresh}
                title="Re-generate Podcast"
                className="p-1 rounded-md text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
            {!isGenerating && !disabled && (
              <ChevronRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-amber-500" />
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
          {isGenerating
            ? "Creating Alex & Jamie's podcast audio in background…"
            : isDone
            ? 'Podcast ready & saved — click to listen or read transcript'
            : isFailed
            ? 'Generation failed. Click refresh icon to retry.'
            : 'Synthesize an interactive AI audio episode summarizing key concepts'}
        </p>
      </div>
    </div>
  );
}

function LearningTimelineTile({
  status,
  isGenerating,
  onClick,
  onRefresh,
  disabled,
}: {
  status: string;
  isGenerating: boolean;
  onClick: () => void;
  onRefresh: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  const isDone = status === 'READY';
  const isFailed = status === 'FAILED';

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`group relative flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card/40 transition-all duration-200 text-left shadow-xs ${
        isGenerating ? 'opacity-80' : ''
      } ${
        disabled 
          ? 'opacity-50 cursor-not-allowed grayscale-[0.5]' 
          : 'hover:bg-card/90 hover:border-cyan-500/50 hover:shadow-md cursor-pointer'
      }`}
    >
      <div className={`p-2 rounded-lg transition-colors shrink-0 ${
        disabled
          ? 'bg-muted text-muted-foreground'
          : isGenerating
          ? 'bg-cyan-500/20 text-cyan-400'
          : isDone
          ? 'bg-emerald-500/10 text-emerald-400'
          : isFailed
          ? 'bg-red-500/10 text-red-400'
          : 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black'
      }`}>
        {isGenerating ? (
          <Loader2 className="w-4 h-4 stroke-[2] animate-spin" />
        ) : isDone ? (
          <CheckCircle className="w-4 h-4 stroke-[2]" />
        ) : isFailed ? (
          <AlertCircle className="w-4 h-4 stroke-[2]" />
        ) : (
          <GitCommit className="w-4 h-4 stroke-[2]" />
        )}
      </div>

      <div className="space-y-0.5 min-w-0 flex-1">
        <div className={`text-xs font-semibold transition-colors flex items-center justify-between ${
          isGenerating ? 'text-cyan-400' : isDone ? 'text-emerald-400' : isFailed ? 'text-red-400' : 'text-foreground group-hover:text-cyan-400'
        }`}>
          <span>
            {isGenerating ? 'Building Path…' : isDone ? 'View Learning Path' : isFailed ? 'Generation Failed' : 'Learning Timeline'}
          </span>

          <div className="flex items-center gap-1">
            {(isDone || isFailed) && !disabled && (
              <button
                type="button"
                onClick={onRefresh}
                title="Re-generate Learning Path"
                className="p-1 rounded-md text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
            {!isGenerating && !disabled && (
              <ChevronRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-cyan-400" />
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
          {isGenerating
            ? 'Structuring your learning roadmap in background…'
            : isDone
            ? 'Roadmap ready & saved — click to view or download'
            : isFailed
            ? 'Generation failed. Click refresh icon to retry.'
            : 'Generate a step-by-step chronological roadmap from your sources'}
        </p>
      </div>
    </div>
  );
}
