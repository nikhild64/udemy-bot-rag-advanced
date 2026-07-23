"use client"

import { SourceStatus } from '@/shared/types';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle, Clock, FileUp, DownloadCloud, FileText, BarChart, Server, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SourceStatusBadgeProps {
  status: SourceStatus;
  progress?: number;
  currentStage?: string;
  className?: string;
}

export function SourceStatusBadge({ status, progress, currentStage, className }: SourceStatusBadgeProps) {
  const getBadgeContent = () => {
    switch (status) {
      case 'Ready':
        return {
          icon: <CheckCircle2 className="w-3 h-3" />,
          label: 'Ready',
          classes: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        };
      case 'Failed':
        return {
          icon: <AlertCircle className="w-3 h-3" />,
          label: 'Failed',
          classes: 'bg-destructive/10 text-destructive border-destructive/20',
        };
      case 'Uploading':
      case 'Uploaded':
        return {
          icon: <FileUp className="w-3 h-3" />,
          label: status,
          classes: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
        };
      case 'Queued':
        return {
          icon: <Clock className="w-3 h-3" />,
          label: 'Queued',
          classes: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
        };
      case 'Deleting':
      case 'Deleted':
        return {
          icon: <Trash2 className="w-3 h-3 animate-pulse" />,
          label: status,
          classes: 'bg-red-500/10 text-red-500 border-red-500/20',
        };
      case 'Downloading':
        return {
          icon: <DownloadCloud className="w-3 h-3 animate-pulse" />,
          label: 'Downloading',
          classes: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        };
      case 'Extracting':
      case 'Normalizing':
        return {
          icon: <FileText className="w-3 h-3 animate-pulse" />,
          label: status,
          classes: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
        };
      case 'Chunking':
        return {
          icon: <BarChart className="w-3 h-3 animate-pulse" />,
          label: 'Chunking',
          classes: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        };
      case 'Embedding':
      case 'Indexing':
        return {
          icon: <Server className="w-3 h-3 animate-pulse" />,
          label: status,
          classes: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
        };
      default:
        // Processing or unknown
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          label: currentStage || status,
          classes: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        };
    }
  };

  const { icon, label, classes } = getBadgeContent();

  return (
    <Badge variant="outline" className={cn("gap-1 text-[11px]", classes, className)}>
      {icon}
      <span>{label} {progress !== undefined && progress > 0 && progress < 100 ? `(${progress}%)` : ''}</span>
    </Badge>
  );
}
