"use client"

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useUIStore } from '@/shared/lib/store';
import { sourcesApi } from '@/features/sources/api/sources.api';
import { apiClient } from '@/shared/api/client';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, Link, Video, FileCode, Type, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'file' | 'url' | 'text';
type UploadStep = 'idle' | 'creating' | 'uploading' | 'completed' | 'error';

export function UploadModal() {
  const isOpen = useUIStore((s) => s.uploadModalOpen);
  const setOpen = useUIStore((s) => s.setUploadModalOpen);
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>('file');

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // URL state
  const [urlInput, setUrlInput] = useState('');
  const [urlTitle, setUrlTitle] = useState('');

  // Text state
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');

  // Progress state
  const [step, setStep] = useState<UploadStep>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);

  useEffect(() => {
    if (mode === 'url' && urlInput) {
      const isYoutube = urlInput.includes('youtube.com') || urlInput.includes('youtu.be');
      if (isYoutube) {
        const fetchTitle = async () => {
          try {
            setIsFetchingTitle(true);
            const data = await apiClient.get<any>(`/api/sources/youtube/metadata?url=${encodeURIComponent(urlInput)}`);
            if (data.title && !urlTitle) {
              setUrlTitle(data.title);
            }
          } catch (err) {
            console.error('Failed to fetch youtube title', err);
          } finally {
            setIsFetchingTitle(false);
          }
        };

        const timeoutId = setTimeout(fetchTitle, 500);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [urlInput, mode]);

  const resetState = () => {
    setSelectedFile(null);
    setUrlInput('');
    setUrlTitle('');
    setTextTitle('');
    setTextContent('');
    setStep('idle');
    setUploadProgress(0);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetState();
    setOpen(false);
  };

  const handleFileSelect = (file: File) => {
    const allowed = ['.pdf', '.txt', '.md', '.markdown', '.docx', '.json', '.mp3', '.mp4', '.wav', '.m4a'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setErrorMessage(`Unsupported file format "${ext}". Supported: ${allowed.join(', ')}`);
      return;
    }
    setErrorMessage(null);
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!activeNotebookId) return;

    try {
      setStep('creating');
      setUploadProgress(30);

      if (mode === 'file') {
        if (!selectedFile) return;

        const source = await sourcesApi.createSource(activeNotebookId, {
          type: selectedFile.type.includes('pdf') ? 'PDF' : 'DOCX',
          title: selectedFile.name,
          displayName: selectedFile.name,
          size: selectedFile.size,
          mimeType: selectedFile.type || 'application/octet-stream',
          status: 'PendingUpload',
        });

        setStep('uploading');
        setUploadProgress(70);

        await sourcesApi.uploadSourceFile(source.id, selectedFile);
      } else if (mode === 'url') {
        if (!urlInput.trim()) {
          setErrorMessage('Please enter a valid Web or YouTube URL');
          setStep('idle');
          return;
        }

        const isYoutube = urlInput.includes('youtube.com') || urlInput.includes('youtu.be');
        const sourceType = isYoutube ? 'YOUTUBE' : 'WEBSITE';
        const displayTitle = urlTitle.trim() || (isYoutube ? 'YouTube Video' : 'Web Source');

        await sourcesApi.createSource(activeNotebookId, {
          type: sourceType,
          title: displayTitle,
          displayName: displayTitle,
          fileUrl: urlInput.trim(),
          status: 'Queued',
        });
      } else if (mode === 'text') {
        if (!textContent.trim()) {
          setErrorMessage('Please enter text content for the note');
          setStep('idle');
          return;
        }

        const displayTitle = textTitle.trim() || 'Pasted Note';

        await sourcesApi.createSource(activeNotebookId, {
          type: 'TEXT',
          title: displayTitle,
          displayName: displayTitle,
          metadata: { rawText: textContent.trim() },
          status: 'Queued',
        });
      }

      setUploadProgress(100);
      setStep('completed');

      queryClient.invalidateQueries({ queryKey: ['sources', activeNotebookId] });
      toast.success(`Knowledge source added successfully!`);

      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err.message || 'Failed to add knowledge source');
      toast.error('Failed to add source');
    }
  };

  const isSubmitDisabled =
    step === 'creating' ||
    step === 'uploading' ||
    step === 'completed' ||
    (mode === 'file' && !selectedFile) ||
    (mode === 'url' && !urlInput.trim()) ||
    (mode === 'text' && !textContent.trim());

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          <span>Add Knowledge Source</span>
        </DialogTitle>
        <DialogDescription>
          Upload documents, add Web/YouTube links, or paste raw text into your notebook.
        </DialogDescription>
      </DialogHeader>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 my-2">
        <button
          onClick={() => { setMode('file'); resetState(); }}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition',
            mode === 'file'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <FileText className="w-4 h-4" />
          <span>File Upload</span>
        </button>

        <button
          onClick={() => { setMode('url'); resetState(); }}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition',
            mode === 'url'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Video className="w-4 h-4 text-red-400" />
          <span>Web & YouTube URL</span>
        </button>

        <button
          onClick={() => { setMode('text'); resetState(); }}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition',
            mode === 'text'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Type className="w-4 h-4 text-emerald-400" />
          <span>Pasted Text Note</span>
        </button>
      </div>

      <div className="space-y-4 my-2">
        {/* MODE: FILE */}
        {mode === 'file' && (
          <>
            {step === 'idle' && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3',
                  dragActive
                    ? 'border-primary bg-primary/10 scale-[0.99]'
                    : 'border-border hover:border-primary/50 bg-card/40'
                )}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf,.txt,.md,.markdown,.docx,.json,.mp3,.mp4,.wav,.m4a';
                  input.onchange = (e: any) => {
                    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                  };
                  input.click();
                }}
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Drag & drop file here, or <span className="text-primary hover:underline">browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports PDF, TXT, Markdown, DOCX, JSON, Audio & Video
                  </p>
                </div>
              </div>
            )}

            {selectedFile && step !== 'completed' && (
              <div className="p-3 bg-muted/40 border border-border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{selectedFile.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {step === 'idle' && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={resetState}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {/* MODE: URL */}
        {mode === 'url' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Web or YouTube URL *</label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or https://example.com/article"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Source Display Title (Optional) 
                {isFetchingTitle && <Loader2 className="inline w-3 h-3 ml-2 animate-spin text-slate-400" />}
              </label>
              <input
                type="text"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                placeholder="e.g. Next.js 15 Documentation"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* MODE: TEXT */}
        {mode === 'text' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Note Title *</label>
              <input
                type="text"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="e.g. Meeting Transcript / Key Takeaways"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Text Content *</label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={6}
                placeholder="Paste raw text, code snippets, or notes here..."
                className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none font-mono"
              />
            </div>
          </div>
        )}

        {/* PROGRESS / STATUS */}
        {(step === 'creating' || step === 'uploading') && (
          <div className="space-y-2 p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex justify-between items-center text-xs text-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                Processing and enqueuing source...
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {step === 'completed' && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-500 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Source added successfully! Queued for AI embedding.</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={handleClose} disabled={step === 'creating' || step === 'uploading'}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          disabled={isSubmitDisabled}
        >
          {step === 'uploading' || step === 'creating' ? 'Processing...' : 'Add Source'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
