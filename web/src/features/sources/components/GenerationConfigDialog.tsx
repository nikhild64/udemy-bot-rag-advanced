"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Radio, GitCommit, Layers } from 'lucide-react';

export type ArtifactType = 'podcast' | 'learningPath' | 'flashcards';

export interface GenerationConfig {
  instructions: string;
  podcastLength?: 'short' | 'medium' | 'long';
  count?: number;
  timelineDays?: '3 days' | '7 days' | '1 month';
}

interface GenerationConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  artifactType: ArtifactType | null;
  isForce?: boolean;
  isGenerating?: boolean;
  onSubmit: (config: GenerationConfig) => void;
}

export function GenerationConfigDialog({
  isOpen,
  onClose,
  artifactType,
  isForce = false,
  isGenerating = false,
  onSubmit,
}: GenerationConfigDialogProps) {
  const [instructions, setInstructions] = useState('');
  const [podcastLength, setPodcastLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [count, setCount] = useState<number>(15);
  const [timelineDays, setTimelineDays] = useState<'3 days' | '7 days' | '1 month'>('7 days');

  // Reset defaults when opening
  useEffect(() => {
    if (isOpen) {
      setInstructions('');
      setPodcastLength('medium');
      setCount(15);
      setTimelineDays('7 days');
    }
  }, [isOpen, artifactType]);

  if (!artifactType) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      instructions: instructions.trim(),
      podcastLength,
      count,
      timelineDays,
    });
  };

  const getTitleAndIcon = () => {
    switch (artifactType) {
      case 'podcast':
        return {
          title: isForce ? 'Customize & Re-generate Podcast' : 'Customize Audio Podcast',
          description: 'Set your preferred podcast length and add custom instructions or focus areas.',
          icon: <Radio className="w-5 h-5 text-amber-500" />,
        };
      case 'learningPath':
        return {
          title: isForce ? 'Customize & Re-generate Timeline' : 'Customize Learning Timeline',
          description: 'Choose your available preparation timeframe and add specific study goals.',
          icon: <GitCommit className="w-5 h-5 text-cyan-400" />,
        };
      case 'flashcards':
        return {
          title: isForce ? 'Customize & Re-generate Flashcards' : 'Customize Study Flashcards',
          description: 'Select how many flashcards to create and specify topics to emphasize.',
          icon: <Layers className="w-5 h-5 text-purple-400" />,
        };
    }
  };

  const { title, description, icon } = getTitleAndIcon();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            {icon}
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Dynamic Option Selector per Artifact Type */}
          {artifactType === 'podcast' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Podcast Length</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  {podcastLength === 'short' && '~10-15 Dialogue Turns'}
                  {podcastLength === 'medium' && '~20-30 Dialogue Turns (Default)'}
                  {podcastLength === 'long' && '~40-50 Dialogue Turns'}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'short', label: 'Short' },
                  { value: 'medium', label: 'Medium', isDefault: true },
                  { value: 'long', label: 'Long' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPodcastLength(opt.value as any)}
                    className={`h-9 px-3 text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                      podcastLength === opt.value
                        ? 'border-amber-500/80 bg-amber-500/10 text-amber-400 font-semibold shadow-xs'
                        : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {opt.isDefault && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-normal">
                        Default
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {artifactType === 'learningPath' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Preparation Timeframe</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Strictly structures topics for this timeframe
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: '3 days', label: '3 Days' },
                  { value: '7 days', label: '7 Days', isDefault: true },
                  { value: '1 month', label: '1 Month' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTimelineDays(opt.value as any)}
                    className={`h-9 px-3 text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                      timelineDays === opt.value
                        ? 'border-cyan-500/80 bg-cyan-500/10 text-cyan-400 font-semibold shadow-xs'
                        : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {opt.isDefault && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-normal">
                        Default
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {artifactType === 'flashcards' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Number of Flashcards</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Cards generated for active recall
                </span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[10, 15, 20, 30].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCount(num)}
                    className={`h-9 px-2 text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-1 ${
                      count === num
                        ? 'border-purple-500/80 bg-purple-500/10 text-purple-400 font-semibold shadow-xs'
                        : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    <span>{num} Cards</span>
                    {num === 15 && (
                      <span className="text-[8px] px-1 rounded bg-purple-500/20 text-purple-300">
                        Default
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Shared Textarea for Specific Request / Search Context */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Specific Requests or Focus Areas (Optional)</span>
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Focus on Chapter 3, emphasize architecture trade-offs, or include code syntax examples..."
              rows={3}
              className="w-full text-xs p-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/60 resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              These instructions are used to narrow down semantic retrieval and guide AI generation.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isGenerating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isForce ? 'Re-generate' : 'Generate'}</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
