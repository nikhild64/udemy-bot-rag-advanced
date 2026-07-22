"use client"

import { Source } from '@/shared/types';
import { useSourceStatusQuery, useDeleteSourceMutation } from '../hooks/useSources';
import { SourceStatusBadge } from './SourceStatusBadge';
import { FileText, FileCode, Video, Music, Trash2, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface SourceItemProps {
  source: Source;
  notebookId: string;
}

export function SourceItem({ source, notebookId }: SourceItemProps) {
  const { data: liveStatus } = useSourceStatusQuery(source.id, source.status);
  const deleteMutation = useDeleteSourceMutation(notebookId);

  const currentStatus = liveStatus?.status || source.status;
  const progress = liveStatus?.progress ?? (currentStatus === 'Indexed' ? 100 : 0);
  const currentStage = liveStatus?.currentStage || (currentStatus === 'Processing' ? 'Embedding' : '');

  const getFileIcon = () => {
    const mime = source.mimeType?.toLowerCase() || '';
    const title = source.title.toLowerCase();

    if (mime.includes('pdf') || title.endsWith('.pdf')) {
      return <FileText className="w-4 h-4 text-red-400 shrink-0" />;
    } else if (mime.includes('video') || title.includes('youtube')) {
      return <Video className="w-4 h-4 text-blue-400 shrink-0" />;
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

  return (
    <div className="p-3 bg-card/60 hover:bg-card border border-border/80 rounded-xl transition-all space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {getFileIcon()}
          <div className="min-w-0">
            <h4 className="text-xs font-medium text-foreground truncate" title={source.title}>
              {source.displayName || source.title}
            </h4>
            {source.size && (
              <p className="text-[11px] text-muted-foreground">{formatSize(source.size)}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <SourceStatusBadge status={currentStatus} progress={progress} currentStage={currentStage} />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => deleteMutation.mutate(source.id)}
            disabled={deleteMutation.isPending}
            title="Delete Source"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress Bar for Queued / Processing */}
      {(currentStatus === 'Processing' || currentStatus === 'Queued' || currentStatus === 'Uploaded') && (
        <div className="space-y-1">
          <Progress value={progress} className="h-1 bg-muted" />
          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
            <span>{currentStage || 'Processing...'}</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {liveStatus?.error && (
        <p className="text-[11px] text-destructive bg-destructive/10 p-1.5 rounded">
          {liveStatus.error}
        </p>
      )}
    </div>
  );
}
