"use client"

import { useState } from 'react';
import { useSourcesQuery, useNotebookArtifactsQuery, useGeneratePodcastMutation, useGenerateLearningPathMutation, useGenerateFlashcardsMutation, useReindexSourceMutation, useDeleteSourceMutation } from '../hooks/useSources';
import { useUIStore } from '@/shared/lib/store';
import { SourceItem } from './SourceItem';
import { SourceViewerDialog } from './SourceViewerDialog';
import { PodcastScriptDialog, PodcastScript } from './PodcastScriptDialog';
import { LearningPathDialog, LearningPath } from './LearningPathDialog';
import { FlashcardsDialog, FlashcardSet } from './FlashcardsDialog';
import { GenerationConfigDialog, ArtifactType, GenerationConfig } from './GenerationConfigDialog';
import { Upload, FilePlus, FolderKanban, Sparkles, Radio, GitCommit, Layers, ChevronRight, Loader2, CheckCircle, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserProfileQuery } from '@/shared/hooks/useUserProfile';
import { ProRequiredModal } from '@/shared/components/ProRequiredModal';

export function SourceList() {
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const setUploadModalOpen = useUIStore((s) => s.setUploadModalOpen);
  const { data: userProfile } = useUserProfileQuery();

  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | undefined>(undefined);

  // ── Dialog modal states ──
  const [podcastOpen, setPodcastOpen] = useState(false);
  const [learningPathOpen, setLearningPathOpen] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [confirmReindexAllOpen, setConfirmReindexAllOpen] = useState(false);
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  const [proRequiredOpen, setProRequiredOpen] = useState(false);
  const [proFeatureName, setProFeatureName] = useState('Re-creating AI Artifacts');

  // ── Customization Dialog state ──
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configArtifactType, setConfigArtifactType] = useState<ArtifactType | null>(null);
  const [configForce, setConfigForce] = useState(false);

  const { data: sources, isLoading, isError, error } = useSourcesQuery(activeNotebookId);
  const { data: artifacts } = useNotebookArtifactsQuery(activeNotebookId);

  const podcastMutation = useGeneratePodcastMutation();
  const learningPathMutation = useGenerateLearningPathMutation();
  const flashcardsMutation = useGenerateFlashcardsMutation();
  const reindexMutation = useReindexSourceMutation(activeNotebookId);
  const deleteMutation = useDeleteSourceMutation(activeNotebookId);

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

  const flashcardsArtifact = artifacts?.flashcards;
  const flashcardsStatus = flashcardsArtifact?.status || 'IDLE';
  const flashcardsData = flashcardsArtifact?.data as FlashcardSet | null;
  const isFlashcardsGenerating = flashcardsStatus === 'GENERATING' || flashcardsMutation.isPending;

  const isAnyArtifactGenerating = isPodcastGenerating || isPathGenerating || isFlashcardsGenerating;

  const openConfigDialog = (type: ArtifactType, force: boolean) => {
    setConfigArtifactType(type);
    setConfigForce(force);
    setConfigDialogOpen(true);
  };

  const handleConfigSubmit = (config: GenerationConfig) => {
    if (!activeNotebookId) return;
    setConfigDialogOpen(false);

    if (configArtifactType === 'podcast') {
      podcastMutation.mutate({
        notebookId: activeNotebookId,
        force: configForce,
        podcastLength: config.podcastLength,
        instructions: config.instructions,
      });
    } else if (configArtifactType === 'learningPath') {
      learningPathMutation.mutate({
        notebookId: activeNotebookId,
        force: configForce,
        timelineDays: config.timelineDays,
        instructions: config.instructions,
      });
    } else if (configArtifactType === 'flashcards') {
      flashcardsMutation.mutate({
        notebookId: activeNotebookId,
        force: configForce,
        count: config.count,
        instructions: config.instructions,
      });
    }
  };

  // ── Podcast Actions ──
  const handlePodcastClick = () => {
    if (!activeNotebookId) return;
    if (podcastStatus === 'READY' && podcastData) {
      setPodcastOpen(true);
    } else if (!isPodcastGenerating) {
      openConfigDialog('podcast', false);
    }
  };

  const handlePodcastRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile?.isPro) {
      setProFeatureName('Re-creating AI Podcast');
      setProRequiredOpen(true);
      return;
    }
    if (!activeNotebookId || isPodcastGenerating) return;
    openConfigDialog('podcast', true);
  };

  // ── Learning Path Actions ──
  const handleLearningPathClick = () => {
    if (!activeNotebookId) return;
    if (pathStatus === 'READY' && pathData) {
      setLearningPathOpen(true);
    } else if (!isPathGenerating) {
      openConfigDialog('learningPath', false);
    }
  };

  const handleLearningPathRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile?.isPro) {
      setProFeatureName('Re-creating Learning Path');
      setProRequiredOpen(true);
      return;
    }
    if (!activeNotebookId || isPathGenerating) return;
    openConfigDialog('learningPath', true);
  };

  // ── Flashcards Actions ──
  const handleFlashcardsClick = () => {
    if (!activeNotebookId) return;
    if (flashcardsStatus === 'READY' && flashcardsData) {
      setFlashcardsOpen(true);
    } else if (!isFlashcardsGenerating) {
      openConfigDialog('flashcards', false);
    }
  };

  const handleFlashcardsRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile?.isPro) {
      setProFeatureName('Re-creating Flashcards');
      setProRequiredOpen(true);
      return;
    }
    if (!activeNotebookId || isFlashcardsGenerating) return;
    openConfigDialog('flashcards', true);
  };

  const handleFlashcardsRegenerate = (count: number) => {
    if (!activeNotebookId || isFlashcardsGenerating) return;
    openConfigDialog('flashcards', true);
  };

  const [selectedExcerpt, setSelectedExcerpt] = useState<string | undefined>(undefined);

  const handleSelectSourceFromPath = (sourceTitle: string, timestamp?: string, sourceId?: string, excerpt?: string) => {
    setLearningPathOpen(false);
    if (!sources || sources.length === 0) return;

    let match: any;

    // Stage 1: Exact Source ID Match
    if (sourceId) {
      match = sources.find((s) => s.id === sourceId);
    }

    // Stage 2: Exact Title / DisplayName Match
    if (!match && sourceTitle) {
      const search = sourceTitle.toLowerCase().trim();
      match = sources.find((s) => {
        const t = (s.title || '').toLowerCase().trim();
        const d = (s.displayName || '').toLowerCase().trim();
        return t === search || d === search;
      });
    }

    // Stage 3: Substring / Includes Title Match
    if (!match && sourceTitle) {
      const search = sourceTitle.toLowerCase().trim();
      match = sources.find((s) => {
        const t = (s.title || '').toLowerCase().trim();
        const d = (s.displayName || '').toLowerCase().trim();
        return (
          (t.length > 0 && (t.includes(search) || search.includes(t))) ||
          (d.length > 0 && (d.includes(search) || search.includes(d)))
        );
      });
    }

    // Stage 4: Word Token Overlap Match (smart fuzzy matching e.g. "Angular Developer Documentation" vs "Angular Guide")
    if (!match && sourceTitle) {
      const tokens = sourceTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !['source', 'document', 'guide', 'web', 'file', 'pdf'].includes(w));

      if (tokens.length > 0) {
        let bestCount = 0;
        for (const s of sources) {
          const combined = `${s.title || ''} ${s.displayName || ''}`.toLowerCase();
          let count = 0;
          for (const token of tokens) {
            if (combined.includes(token)) count++;
          }
          if (count > bestCount) {
            bestCount = count;
            match = s;
          }
        }
      }
    }

    // Stage 5: Excerpt text search across sources
    if (!match && excerpt) {
      const lowerExcerpt = excerpt.toLowerCase().trim();
      match = sources.find((s) => {
        const text = (s as any).rawText?.toLowerCase() || '';
        return text.includes(lowerExcerpt);
      });
    }

    if (match) {
      setSelectedSourceId(match.id);
    } else {
      setSelectedSourceId(sources[0].id);
    }
    setSelectedTimestamp(timestamp);
    setSelectedExcerpt(excerpt);
    setViewerOpen(true);
  };

  const hasSources = !!(sources && sources.length > 0);
  const hasReadySources = hasSources && sources.some((s) => s.status === 'Ready' || (s.status as string) === 'Indexed');
  const isAnySourceProcessing = sources?.some((s) => !['Ready', 'Indexed', 'Failed'].includes(s.status as string));
  const areAllSourcesReady = hasSources && !isAnySourceProcessing;

  const handleReindexAll = () => {
    if (sources && sources.length > 0) {
      sources.forEach((source) => {
        if (source.status === 'Ready' || (source.status as string) === 'Indexed' || source.status === 'Failed') {
          reindexMutation.mutate(source.id);
        }
      });
    }
  };

  const handleDeleteAll = () => {
    if (sources && sources.length > 0) {
      sources.forEach((source) => {
        deleteMutation.mutate(source.id);
      });
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
          {hasSources && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs flex items-center gap-1 border-dashed text-destructive hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
              onClick={() => setConfirmDeleteAllOpen(true)}
              disabled={deleteMutation.isPending}
              title="Delete All Sources"
            >
              <Trash2 className={`w-3.5 h-3.5 ${deleteMutation.isPending ? 'animate-pulse' : ''}`} />
            </Button>
          )}
          {hasSources && areAllSourcesReady && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs flex items-center gap-1 border-dashed text-muted-foreground hover:text-foreground"
              onClick={() => setConfirmReindexAllOpen(true)}
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
      <div className="flex-1 min-h-[80px] overflow-y-auto space-y-1.5 pr-1">
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
          <div className="flex flex-col items-center justify-center p-6 border border-dashed border-border rounded-xl text-center space-y-2 bg-muted/20">
            <FilePlus className="w-7 h-7 text-muted-foreground/50 stroke-1" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground">No sources added yet</p>
              <p className="text-[11px] text-muted-foreground max-w-[200px]">
                Upload PDFs, Markdown documents, audio/video files, or web links to train your AI.
              </p>
            </div>
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setUploadModalOpen(true)}>
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Knowledge Source</span>
            </Button>
          </div>
        )}
      </div>

      {/* Quick Actions Section (Always Pinned at Bottom) */}
      {hasSources && (
        <div className="pt-2 border-t border-border/60 space-y-2 shrink-0 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between px-1 shrink-0">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick Actions</span>
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-1.5 overflow-y-auto max-h-[220px] sm:max-h-none pr-0.5">
            {/* ── Audio Podcast Tile ── */}
            <PodcastTile
              status={podcastStatus}
              isGenerating={isPodcastGenerating}
              progress={podcastArtifact?.progress}
              phase={podcastArtifact?.phase}
              onClick={handlePodcastClick}
              onRefresh={handlePodcastRefresh}
              disabled={!areAllSourcesReady}
            />

            {/* ── Learning Timeline Tile ── */}
            <LearningTimelineTile
              status={pathStatus}
              isGenerating={isPathGenerating}
              progress={pathArtifact?.progress}
              phase={pathArtifact?.phase}
              onClick={handleLearningPathClick}
              onRefresh={handleLearningPathRefresh}
              disabled={!areAllSourcesReady}
            />

            {/* ── Study Flashcards Tile ── */}
            <FlashcardsTile
              status={flashcardsStatus}
              isGenerating={isFlashcardsGenerating}
              progress={flashcardsArtifact?.progress}
              phase={flashcardsArtifact?.phase}
              onClick={handleFlashcardsClick}
              onRefresh={handleFlashcardsRefresh}
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
          initialExcerpt={selectedExcerpt}
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
        sources={sources || []}
      />

      {/* Flashcards Dialog */}
      <FlashcardsDialog
        isOpen={flashcardsOpen}
        onClose={() => setFlashcardsOpen(false)}
        isGenerating={isFlashcardsGenerating}
        flashcardSet={flashcardsData}
        onRegenerate={handleFlashcardsRegenerate}
      />

      {/* Generation Customization Config Dialog */}
      <GenerationConfigDialog
        isOpen={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        artifactType={configArtifactType}
        isForce={configForce}
        isGenerating={
          configArtifactType === 'podcast'
            ? isPodcastGenerating
            : configArtifactType === 'learningPath'
            ? isPathGenerating
            : configArtifactType === 'flashcards'
            ? isFlashcardsGenerating
            : false
        }
        onSubmit={handleConfigSubmit}
      />

      {/* Pro Entitlement Required Dialog */}
      <ProRequiredModal
        isOpen={proRequiredOpen}
        onClose={() => setProRequiredOpen(false)}
        featureName={proFeatureName}
      />

      {/* Custom Re-index All Sources Confirmation Dialog */}
      <Dialog open={confirmReindexAllOpen} onOpenChange={setConfirmReindexAllOpen}>
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-primary text-base font-semibold">
            <RefreshCw className="w-5 h-5 shrink-0 text-primary" />
            <span>Re-index All Knowledge Sources</span>
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            Are you sure you want to re-index all <span className="font-semibold text-foreground">{sources?.length || 0} knowledge sources</span> in this notebook?
            Re-indexing will re-extract text, re-chunk documents, and update vector search embeddings. Your existing chat history will be preserved.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" size="sm" onClick={() => setConfirmReindexAllOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            disabled={reindexMutation.isPending}
            onClick={() => {
              handleReindexAll();
              setConfirmReindexAllOpen(false);
            }}
          >
            {reindexMutation.isPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Triggering...
              </span>
            ) : (
              'Re-index All'
            )}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Custom Delete All Sources Confirmation Dialog */}
      <Dialog open={confirmDeleteAllOpen} onOpenChange={setConfirmDeleteAllOpen}>
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-destructive text-base font-semibold">
            <Trash2 className="w-5 h-5 shrink-0 text-destructive" />
            <span>Delete All Knowledge Sources</span>
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            Are you sure you want to delete all <span className="font-semibold text-foreground">{sources?.length || 0} knowledge sources</span> in this notebook?
            This action cannot be undone and will permanently delete all extracted text, chunks, and embeddings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" size="sm" onClick={() => setConfirmDeleteAllOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="font-medium"
            disabled={deleteMutation.isPending}
            onClick={() => {
              handleDeleteAll();
              setConfirmDeleteAllOpen(false);
            }}
          >
            {deleteMutation.isPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Deleting...
              </span>
            ) : (
              'Delete All'
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Extracted tile sub-components
// ─────────────────────────────────────────────────────────────

function PodcastTile({
  status,
  isGenerating,
  progress,
  phase,
  onClick,
  onRefresh,
  disabled,
}: {
  status: string;
  isGenerating: boolean;
  progress?: number;
  phase?: string;
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
          ? 'bg-amber-500/15 text-amber-500'
          : isFailed
          ? 'bg-red-500/10 text-red-400'
          : 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-black'
      }`}>
        {isDone ? (
          <CheckCircle className="w-4 h-4 stroke-[2]" />
        ) : isFailed ? (
          <AlertCircle className="w-4 h-4 stroke-[2]" />
        ) : (
          <Radio className={`w-4 h-4 stroke-[2] ${isGenerating ? 'animate-pulse' : ''}`} />
        )}
      </div>

      <div className="space-y-0.5 min-w-0 flex-1">
        <div className={`text-xs font-semibold transition-colors flex items-center justify-between ${
          isGenerating ? 'text-amber-400' : isDone ? 'text-amber-500 font-bold' : isFailed ? 'text-red-400' : 'text-foreground group-hover:text-amber-500'
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

        {isGenerating ? (
          <div className="mt-1.5 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-amber-500 tracking-wider">
              <span>{phase || "Starting pipeline..."}</span>
              <span>{progress || 0}%</span>
            </div>
            <div className="h-1.5 w-full bg-border/80 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 transition-all duration-500 ease-out"
                style={{ width: `${progress || 5}%` }} 
              />
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {isDone
              ? 'Podcast ready & saved — click to listen or read transcript'
              : isFailed
              ? 'Generation failed. Click refresh icon to retry.'
              : 'Synthesize an interactive AI audio episode summarizing key concepts'}
          </p>
        )}
      </div>
    </div>
  );
}

function LearningTimelineTile({
  status,
  isGenerating,
  progress,
  phase,
  onClick,
  onRefresh,
  disabled,
}: {
  status: string;
  isGenerating: boolean;
  progress?: number;
  phase?: string;
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
          ? 'bg-cyan-500/15 text-cyan-400'
          : isFailed
          ? 'bg-red-500/10 text-red-400'
          : 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black'
      }`}>
        {isDone ? (
          <CheckCircle className="w-4 h-4 stroke-[2]" />
        ) : isFailed ? (
          <AlertCircle className="w-4 h-4 stroke-[2]" />
        ) : (
          <GitCommit className={`w-4 h-4 stroke-[2] ${isGenerating ? 'animate-pulse' : ''}`} />
        )}
      </div>

      <div className="space-y-0.5 min-w-0 flex-1">
        <div className={`text-xs font-semibold transition-colors flex items-center justify-between ${
          isGenerating ? 'text-cyan-400' : isDone ? 'text-cyan-400 font-bold' : isFailed ? 'text-red-400' : 'text-foreground group-hover:text-cyan-400'
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

        {isGenerating ? (
          <div className="mt-1.5 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-cyan-500 tracking-wider">
              <span>{phase || "Starting pipeline..."}</span>
              <span>{progress || 0}%</span>
            </div>
            <div className="h-1.5 w-full bg-border/80 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-500 transition-all duration-500 ease-out"
                style={{ width: `${progress || 5}%` }} 
              />
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {isDone
              ? 'Roadmap ready & saved — click to view or download'
              : isFailed
              ? 'Generation failed. Click refresh icon to retry.'
              : 'Generate a step-by-step chronological roadmap from your sources'}
          </p>
        )}
      </div>
    </div>
  );
}

function FlashcardsTile({
  status,
  isGenerating,
  progress,
  phase,
  onClick,
  onRefresh,
  disabled,
}: {
  status: string;
  isGenerating: boolean;
  progress?: number;
  phase?: string;
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
          : 'hover:bg-card/90 hover:border-purple-500/50 hover:shadow-md cursor-pointer'
      }`}
    >
      <div
        className={`p-2 rounded-lg transition-colors shrink-0 ${
          disabled
            ? 'bg-muted text-muted-foreground'
            : isGenerating
            ? 'bg-purple-500/20 text-purple-400'
            : isDone
            ? 'bg-purple-500/15 text-purple-400'
            : isFailed
            ? 'bg-red-500/10 text-red-400'
            : 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white'
        }`}
      >
        {isDone ? (
          <CheckCircle className="w-4 h-4 stroke-[2]" />
        ) : isFailed ? (
          <AlertCircle className="w-4 h-4 stroke-[2]" />
        ) : (
          <Layers className={`w-4 h-4 stroke-[2] ${isGenerating ? 'animate-pulse' : ''}`} />
        )}
      </div>

      <div className="space-y-0.5 min-w-0 flex-1">
        <div
          className={`text-xs font-semibold transition-colors flex items-center justify-between ${
            isGenerating
              ? 'text-purple-400'
              : isDone
              ? 'text-purple-400 font-bold'
              : isFailed
              ? 'text-red-400'
              : 'text-foreground group-hover:text-purple-400'
          }`}
        >
          <span>
            {isGenerating ? 'Creating Cards…' : isDone ? 'Study Flashcards' : isFailed ? 'Generation Failed' : 'Study Flashcards'}
          </span>

          <div className="flex items-center gap-1">
            {(isDone || isFailed) && !disabled && (
              <button
                type="button"
                onClick={onRefresh}
                title="Re-generate Flashcards"
                className="p-1 rounded-md text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
            {!isGenerating && !disabled && (
              <ChevronRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-purple-400" />
            )}
          </div>
        </div>

        {isGenerating ? (
          <div className="mt-1.5 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-purple-500 tracking-wider">
              <span>{phase || "Starting pipeline..."}</span>
              <span>{progress || 0}%</span>
            </div>
            <div className="h-1.5 w-full bg-border/80 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 transition-all duration-500 ease-out"
                style={{ width: `${progress || 5}%` }} 
              />
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {isDone
              ? 'Flashcard deck ready — click to practice active recall'
              : isFailed
              ? 'Generation failed. Click refresh icon to retry.'
              : 'Generate a deck of interactive study flashcards for active recall'}
          </p>
        )}
      </div>
    </div>
  );
}
