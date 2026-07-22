'use client';

import React from 'react';
import { X, FileText, HardDrive, Calendar, Database, CheckCircle } from 'lucide-react';
import { Source } from '@/shared/types';
import { sourcesApi } from '../api/sources.api';
import { Button } from '@/components/ui/button';

interface SourceMetadataDrawerProps {
  source: Source | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SourceMetadataDrawer({ source, isOpen, onClose }: SourceMetadataDrawerProps) {
  if (!isOpen || !source) return null;

  const handleDownload = async () => {
    try {
      const info = await sourcesApi.downloadSource(source.id);
      if (info.downloadUrl) {
        window.open(info.downloadUrl, '_blank');
      }
    } catch (e) {
      console.error('Download failed', e);
    }
  };

  const formatSize = (bytes?: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-label="Source Details & Metadata"
    >
      <div className="w-full max-w-md bg-card border-l border-border h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
        <div>
          <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground truncate max-w-[240px]">
                {source.displayName || source.title}
              </h3>
            </div>
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Embedded YouTube Video Preview */}
            {(() => {
              const videoId =
                source.metadata?.videoId ||
                (source.fileUrl?.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/) || [])[1];

              if (!videoId) return null;

              return (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Video Player Preview</h4>
                  <div className="relative rounded-xl overflow-hidden border border-border bg-black aspect-video shadow-md">
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title={source.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              );
            })()}

            <div className="bg-background p-4 rounded-xl border border-border space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-primary" /> Source Type</span>
                <span className="font-mono font-medium text-foreground">{source.type}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-primary" /> Status</span>
                <span className="font-mono font-medium text-primary">{source.status}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5 text-primary" /> File Size</span>
                <span className="font-mono font-medium text-foreground">{formatSize(source.size)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-primary" /> Uploaded</span>
                <span className="font-mono font-medium text-foreground">
                  {new Date(source.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {source.storagePath && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Storage Path</h4>
                <div className="p-3 bg-background rounded-xl border border-border font-mono text-xs text-foreground break-all">
                  {source.storagePath}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raw Metadata JSON</h4>
              <pre className="p-3 bg-background rounded-xl border border-border text-xs font-mono text-primary overflow-x-auto max-h-48">
                {JSON.stringify(source.metadata || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border flex gap-3">
          <Button
            onClick={handleDownload}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold shadow-xs"
          >
            Download File
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl text-sm font-medium"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
