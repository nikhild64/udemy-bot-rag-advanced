import { Dialog } from '@/components/ui/dialog';
import { Source } from '@/shared/types';
import { SourceViewer } from './SourceViewer';
import { FileText, Video, Music, FileCode, HardDrive, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';

interface SourceViewerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Source[];
  initialSourceId: string;
  initialTimestamp?: string;
}

export function SourceViewerDialog({ isOpen, onClose, sources, initialSourceId, initialTimestamp }: SourceViewerDialogProps) {
  const [activeSourceId, setActiveSourceId] = useState(initialSourceId);
  const [activeTimestamp, setActiveTimestamp] = useState<string | undefined>(initialTimestamp);
  const activeSourceRef = useRef<HTMLButtonElement>(null);

  // Update active source if initialSourceId changes or dialog opens
  useEffect(() => {
    if (initialSourceId) {
      setActiveSourceId(initialSourceId);
    }
    setActiveTimestamp(initialTimestamp);
  }, [initialSourceId, initialTimestamp, isOpen]);

  // Scroll active source into view
  useEffect(() => {
    if (isOpen && activeSourceRef.current) {
      const timer = setTimeout(() => {
        activeSourceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [activeSourceId, isOpen]);

  const getFileIcon = (source: Source) => {
    const mime = source.mimeType?.toLowerCase() || '';
    const title = source.title.toLowerCase();
    const type = String(source.type || '').toUpperCase();
    const urlStr = source.fileUrl || (source.metadata?.url as string) || '';
    const isYouTube =
      type === 'YOUTUBE' ||
      urlStr.includes('youtu') ||
      title.includes('youtube') ||
      !!source.metadata?.videoId;

    if (type === 'YOUTUBE' || isYouTube || mime.includes('video')) {
      return <Video className="w-4 h-4 text-blue-400 shrink-0" />;
    } else if (type === 'WEBSITE' || type === 'URL' || (source.metadata?.url && !isYouTube)) {
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

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => !open && onClose()}
      contentClassName="w-[calc(100%-1rem)] sm:max-w-[85vw] w-full p-0 gap-0 overflow-hidden bg-background border-border shadow-2xl h-[92dvh] sm:h-[85vh] flex flex-col md:flex-row"
    >
        {/* Left Sidebar / Top Bar - Source List */}
        <div className="w-full md:w-[300px] border-b md:border-b-0 md:border-r border-border bg-card/30 flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 md:p-4 border-b border-border bg-muted/20 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-xs md:text-sm">Notebook Sources</h3>
              <p className="text-[10px] md:text-xs text-muted-foreground">{sources.length} available</p>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 overflow-x-auto md:overflow-y-auto">
            <div className="p-2 flex md:flex-col gap-1.5 min-w-max md:min-w-0">
              {sources.map((src) => {
                const isActive = src.id === activeSourceId;
                return (
                  <button
                    key={src.id}
                    ref={isActive ? activeSourceRef : null}
                    onClick={() => setActiveSourceId(src.id)}
                    className={cn(
                      "flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg text-left transition-all duration-200 border shrink-0 md:w-full",
                      isActive 
                        ? "bg-primary/10 border-primary/30 text-primary shadow-xs" 
                        : "bg-transparent border-transparent hover:bg-muted/50 hover:border-border/50 text-foreground"
                    )}
                  >
                    <div className={cn(
                      "p-1 md:p-1.5 rounded-md flex items-center justify-center shrink-0",
                      isActive ? "bg-primary/20" : "bg-muted text-muted-foreground"
                    )}>
                      {getFileIcon(src)}
                    </div>
                    <div className="min-w-0 max-w-[140px] md:max-w-none flex-1">
                      <p className={cn(
                        "text-xs font-medium truncate",
                        isActive ? "text-primary" : "text-foreground"
                      )}>{src.displayName || src.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate opacity-80 mt-0.5 hidden md:block">
                        {src.status}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Area - Source Viewer */}
        <div className="flex-1 flex flex-col bg-background min-w-0 min-h-0 overflow-hidden">
          {activeSourceId ? (
            <SourceViewer
              sourceId={activeSourceId}
              timestamp={activeSourceId === initialSourceId ? activeTimestamp : undefined}
              className="h-full max-h-none"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a source to view
            </div>
          )}
        </div>
    </Dialog>
  );
}
