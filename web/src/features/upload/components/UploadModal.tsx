"use client"

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useUIStore } from '@/shared/lib/store';
import { sourcesApi } from '@/features/sources/api/sources.api';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type UploadStep = 'idle' | 'creating' | 'uploading' | 'completed' | 'error';

export function UploadModal() {
  const isOpen = useUIStore((s) => s.uploadModalOpen);
  const setOpen = useUIStore((s) => s.setUploadModalOpen);
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const queryClient = useQueryClient();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<UploadStep>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const resetState = () => {
    setSelectedFile(null);
    setStep('idle');
    setUploadProgress(0);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetState();
    setOpen(false);
  };

  const handleFileSelect = (file: File) => {
    // Validate file extension
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
    if (!selectedFile || !activeNotebookId) return;

    try {
      setStep('creating');
      setUploadProgress(20);

      // 1. Create source record in backend
      const source = await sourcesApi.createSource(activeNotebookId, {
        type: selectedFile.type.includes('pdf') ? 'pdf' : 'file',
        title: selectedFile.name,
        displayName: selectedFile.name,
        size: selectedFile.size,
        mimeType: selectedFile.type || 'application/octet-stream',
        status: 'Uploaded',
      });

      setStep('uploading');
      setUploadProgress(60);

      // 2. Upload actual file binary
      await sourcesApi.uploadSourceFile(source.id, selectedFile);

      setUploadProgress(100);
      setStep('completed');

      // Refresh sources list for active notebook
      queryClient.invalidateQueries({ queryKey: ['sources', activeNotebookId] });
      toast.success(`"${selectedFile.name}" uploaded successfully! Processing started.`);

      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err.message || 'Failed to upload source file');
      toast.error('Upload failed');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          <span>Upload Knowledge Source</span>
        </DialogTitle>
        <DialogDescription>
          Upload documents (PDF, TXT, Markdown, Audio/Video) to index into your notebook.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 my-2">
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
                Drag & drop your file here, or <span className="text-primary hover:underline">browse</span>
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

        {(step === 'creating' || step === 'uploading') && (
          <div className="space-y-2 p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex justify-between items-center text-xs text-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                {step === 'creating' ? 'Creating source record...' : 'Uploading file bytes...'}
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {step === 'completed' && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-500 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Upload completed! Queued for AI embedding.</span>
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
          disabled={!selectedFile || step === 'creating' || step === 'uploading' || step === 'completed'}
        >
          {step === 'uploading' ? 'Uploading...' : 'Start Upload'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
