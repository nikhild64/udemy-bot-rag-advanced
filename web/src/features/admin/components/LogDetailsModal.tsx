"use client"

import React from 'react';
import { SystemLogItem } from '../api/admin.api';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, Terminal, Clock, Layers } from 'lucide-react';

interface LogDetailsModalProps {
  log: SystemLogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogDetailsModal({ log, open, onOpenChange }: LogDetailsModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!log) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBadgeVariant = (level: string): "destructive" | "default" | "secondary" | "outline" => {
    switch (level) {
      case 'ERROR':
        return 'destructive';
      case 'WARN':
        return 'outline';
      case 'INFO':
        return 'default';
      default:
        return 'secondary';
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange} contentClassName="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden bg-card text-foreground border border-border">
      <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border">

          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-primary" />
            <DialogTitle className="text-base font-semibold">System Log Details</DialogTitle>
            <Badge variant={getBadgeVariant(log.level)} className="text-xs uppercase tracking-wider">
              {log.level}
            </Badge>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={handleCopyJson}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy JSON'}
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pt-4 pr-1 text-sm">
          {/* Main info row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/40 p-3 rounded-lg border border-border/50 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground font-medium">Timestamp:</span>
              <span className="font-mono text-foreground">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground font-medium">Context:</span>
              <span className="font-semibold text-foreground">{log.context || 'System'}</span>
            </div>

          </div>

          {/* Log Message */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Log Message
            </label>
            <div className="p-3 bg-slate-950 text-slate-100 dark:bg-zinc-950 dark:text-zinc-100 rounded-lg font-mono text-xs leading-relaxed whitespace-pre-wrap break-all border border-border/60">
              {log.message}
            </div>
          </div>

          {/* Metadata JSON Viewer */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Metadata & Stack Trace
              </label>
              <pre className="p-3.5 bg-slate-950 text-emerald-400 dark:bg-zinc-950 dark:text-emerald-400 rounded-lg font-mono text-xs leading-relaxed overflow-x-auto border border-border/60 max-h-72">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
    </Dialog>
  );
}

