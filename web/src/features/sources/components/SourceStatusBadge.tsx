"use client"

import { SourceStatus } from '@/shared/types';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle, Clock, FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SourceStatusBadgeProps {
  status: SourceStatus;
  progress?: number;
  currentStage?: string;
  className?: string;
}

export function SourceStatusBadge({ status, progress, currentStage, className }: SourceStatusBadgeProps) {
  switch (status) {
    case 'Indexed':
      return (
        <Badge variant="outline" className={cn("bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 text-[11px]", className)}>
          <CheckCircle2 className="w-3 h-3" />
          <span>Ready</span>
        </Badge>
      );
    case 'Processing':
      return (
        <Badge variant="outline" className={cn("bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1 text-[11px]", className)}>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{currentStage || 'Processing'} {progress !== undefined ? `(${progress}%)` : ''}</span>
        </Badge>
      );
    case 'Queued':
      return (
        <Badge variant="outline" className={cn("bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1 text-[11px]", className)}>
          <Clock className="w-3 h-3" />
          <span>Queued</span>
        </Badge>
      );
    case 'Uploaded':
      return (
        <Badge variant="outline" className={cn("bg-purple-500/10 text-purple-500 border-purple-500/20 gap-1 text-[11px]", className)}>
          <FileUp className="w-3 h-3" />
          <span>Uploaded</span>
        </Badge>
      );
    case 'Failed':
      return (
        <Badge variant="outline" className={cn("bg-destructive/10 text-destructive border-destructive/20 gap-1 text-[11px]", className)}>
          <AlertCircle className="w-3 h-3" />
          <span>Failed</span>
        </Badge>
      );
    default:
      return <Badge variant="secondary" className={className}>{status}</Badge>;
  }
}
