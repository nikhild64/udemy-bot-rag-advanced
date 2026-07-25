"use client"

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Source } from '@/shared/types';
import { cn } from '@/lib/utils';
import {
  useDeleteSourceMutation,
  useReindexSourceMutation,
  useRetrySourceMutation,
  useCancelSourceMutation,
} from '../hooks/useSources';
import { SourceStatusBadge } from './SourceStatusBadge';
import { SourceMetadataDrawer } from './SourceMetadataDrawer';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  FileText,
  FileCode,
  Video,
  Music,
  Trash2,
  HardDrive,
  MoreVertical,
  RefreshCw,
  RotateCcw,
  Ban,
  Info,
  Download,
  Loader2,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { sourcesApi } from '../api/sources.api';

interface SourceItemProps {
  source: Source;
  notebookId: string;
  onOpenViewer?: (sourceId: string) => void;
}

export function SourceItem({ source, notebookId, onOpenViewer }: SourceItemProps) {
  const [metadataDrawerOpen, setMetadataDrawerOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const deleteMutation = useDeleteSourceMutation(notebookId);
  const reindexMutation = useReindexSourceMutation(notebookId);
  const retryMutation = useRetrySourceMutation(notebookId);
  const cancelMutation = useCancelSourceMutation(notebookId);

  const [isForcedQueued, setIsForcedQueued] = useState(false);

  useEffect(() => {
    if (reindexMutation.isPending || retryMutation.isPending) {
      setIsForcedQueued(true);
    } else if (isForcedQueued) {
      const timer = setTimeout(() => setIsForcedQueued(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [reindexMutation.isPending, retryMutation.isPending, isForcedQueued]);

  useEffect(() => {
    const s = source.status;
    if (s && s !== 'Ready' && s !== 'Failed') {
      setIsForcedQueued(false);
    }
  }, [source.status]);

  const isOptimisticQueued = isForcedQueued || reindexMutation.isPending || retryMutation.isPending;
  const currentStatus = isOptimisticQueued ? 'Queued' : source.status;
  const progress = isOptimisticQueued ? 0 : ((source as any).progress ?? (currentStatus === 'Ready' ? 100 : 0));
  const currentStage = isOptimisticQueued ? 'Queued for processing' : ((source as any).currentStage || '');

  const isProcessing = ['Downloading', 'Extracting', 'Normalizing', 'Chunking', 'Embedding', 'Indexing'].includes(currentStatus);
  const isQueuedOrProcessing = isProcessing || currentStatus === 'Queued' || currentStatus === 'Uploading' || currentStatus === 'Uploaded';

  const extractVideoId = (url?: string | null) => {
    if (!url) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  const videoId =
    source.metadata?.videoId ||
    extractVideoId(source.fileUrl || (source.metadata?.url as string) || (source.metadata?.videoUrl as string));

  const isYouTube =
    String(source.type || '').toUpperCase() === 'YOUTUBE' ||
    !!videoId ||
    !!(source.fileUrl && source.fileUrl.includes('youtu')) ||
    !!((source.metadata?.url as string)?.includes('youtu'));

  const getFileIcon = () => {
    const mime = source.mimeType?.toLowerCase() || '';
    const title = source.title.toLowerCase();
    const type = String(source.type || '').toUpperCase();

    if (type === 'ZIP' || type === 'ARCHIVE' || mime.includes('zip') || mime.includes('compressed') || title.endsWith('.zip')) {
      return <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />;
    } else if (type === 'YOUTUBE' || isYouTube || mime.includes('video') || title.includes('youtube')) {
      return <Video className="w-4 h-4 text-blue-400 shrink-0" />;
    } else if (type === 'WEBSITE' || type === 'URL') {
      return <Globe className="w-4 h-4 text-cyan-400 shrink-0" />;
    } else if (type === 'PDF' || mime.includes('pdf') || title.endsWith('.pdf')) {
      return <FileText className="w-4 h-4 text-red-400 shrink-0" />;
    } else if (type === 'VTT' || mime.includes('vtt') || mime.includes('subrip') || title.endsWith('.vtt') || title.endsWith('.srt')) {
      return <FileText className="w-4 h-4 text-emerald-400 shrink-0" />;
    } else if (mime.includes('audio')) {
      return <Music className="w-4 h-4 text-green-400 shrink-0" />;
    } else if (mime.includes('json') || mime.includes('javascript') || mime.includes('typescript')) {
      return <FileCode className="w-4 h-4 text-yellow-400 shrink-0" />;
    }
    return <HardDrive className="w-4 h-4 text-primary shrink-0" />;
  };

  const formatSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async () => {
    try {
      const res = await sourcesApi.downloadSource(source.id);
      if (res.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
      }
    } catch (e) {
      toast.error('Failed to download source file');
    }
  };

  const isAnyMutationPending =
    deleteMutation.isPending ||
    reindexMutation.isPending ||
    retryMutation.isPending ||
    cancelMutation.isPending;

  return (
    <>
      <div 
        className={cn(
          "p-2.5 bg-card/60 hover:bg-card border border-border/80 rounded-xl transition-all space-y-1.5 group",
          onOpenViewer && !isAnyMutationPending && "cursor-pointer hover:border-primary/50",
          (currentStatus === 'Deleting' || deleteMutation.isPending) && "opacity-60 pointer-events-none"
        )}
        onClick={() => !isAnyMutationPending && onOpenViewer && onOpenViewer(source.id)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {getFileIcon()}
            <div className="min-w-0">
              <h4 className="text-xs font-medium text-foreground truncate" title={source.title}>
                {source.displayName || source.title}
              </h4>
              {source.size ? (
                <p className="text-[11px] text-muted-foreground">{formatSize(source.size)}</p>
              ) : (
                videoId && <p className="text-[11px] text-blue-400 font-medium">YouTube Video</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <SourceStatusBadge status={currentStatus} progress={progress} currentStage={currentStage} />
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu
                trigger={
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    disabled={isAnyMutationPending}
                  >
                    {isAnyMutationPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    ) : (
                      <MoreVertical className="w-3.5 h-3.5" />
                    )}
                  </Button>
                }
              >
              <DropdownMenuItem onClick={() => setMetadataDrawerOpen(true)}>
                <Info className="w-3.5 h-3.5 mr-2 text-indigo-400" /> View Metadata
              </DropdownMenuItem>

              {(source.fileUrl || source.storagePath) && (
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5 mr-2 text-emerald-400" /> Download File
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                className={cn(reindexMutation.isPending || isQueuedOrProcessing ? "pointer-events-none opacity-50" : "")}
                onClick={reindexMutation.isPending || isQueuedOrProcessing ? undefined : () => reindexMutation.mutate(source.id)}
              >
                {reindexMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-2 text-primary animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-2 text-primary" />
                )}
                <span>{reindexMutation.isPending ? 'Re-indexing...' : 'Re-index'}</span>
              </DropdownMenuItem>

              {currentStatus === 'Failed' && (
                <DropdownMenuItem
                  className={cn(retryMutation.isPending ? "pointer-events-none opacity-50" : "")}
                  onClick={retryMutation.isPending ? undefined : () => retryMutation.mutate(source.id)}
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-2 text-amber-400 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 mr-2 text-amber-400" />
                  )}
                  <span>Retry Ingestion</span>
                </DropdownMenuItem>
              )}

              {(isQueuedOrProcessing) && (
                <DropdownMenuItem
                  className={cn(cancelMutation.isPending ? "pointer-events-none opacity-50" : "")}
                  onClick={cancelMutation.isPending ? undefined : () => cancelMutation.mutate(source.id)}
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-2 text-amber-400 animate-spin" />
                  ) : (
                    <Ban className="w-3.5 h-3.5 mr-2 text-amber-400" />
                  )}
                  <span>Cancel Processing</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                destructive
                className={cn(deleteMutation.isPending ? "pointer-events-none opacity-50" : "")}
                onClick={deleteMutation.isPending ? undefined : () => setConfirmDeleteOpen(true)}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                )}
                <span>{deleteMutation.isPending ? 'Deleting...' : 'Delete'}</span>
              </DropdownMenuItem>
            </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Progress Bar for Queued / Processing */}
        {(isQueuedOrProcessing || currentStatus === 'Deleting') && (
          <div className="space-y-1">
            <Progress value={progress} className="h-1 bg-muted" />
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span>{currentStage || currentStatus}</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}

        {((source as any).error || (source as any).errorMessage) && (
          <p className="text-[11px] text-destructive bg-destructive/10 p-1.5 rounded">
            {(source as any).error || (source as any).errorMessage}
          </p>
        )}
      </div>

      <SourceMetadataDrawer
        source={source}
        isOpen={metadataDrawerOpen}
        onClose={() => setMetadataDrawerOpen(false)}
      />

      {/* Custom Delete Source Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-destructive text-base font-semibold">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Delete Knowledge Source</span>
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">"{source.displayName || source.title}"</span>?
            This will permanently remove the source file and all its indexed vector embeddings. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" size="sm" onClick={() => setConfirmDeleteOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={() => {
              deleteMutation.mutate(source.id);
              setConfirmDeleteOpen(false);
            }}
          >
            {deleteMutation.isPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Deleting...
              </span>
            ) : (
              'Delete Source'
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
