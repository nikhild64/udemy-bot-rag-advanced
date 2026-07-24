'use client';

import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, GitCommit, Clock, BookOpen, CheckCircle2, ExternalLink } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface LearningSourceRef {
  title: string;
  timestamp?: string;
}

export interface LearningStep {
  order: number;
  title: string;
  description: string;
  estimatedDuration: string;
  sources: (string | LearningSourceRef)[];
  keyOutcomes: string[];
}

export interface LearningPath {
  title: string;
  description: string;
  estimatedTotalDuration: string;
  steps: LearningStep[];
}

interface LearningPathDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isGenerating: boolean;
  learningPath: LearningPath | null;
  onSelectSource?: (sourceTitle: string, timestamp?: string) => void;
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────

function LearningPathSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-5 w-3/4 rounded-lg bg-white/5" />
        <div className="h-3 w-full rounded bg-white/5" />
        <div className="h-3 w-5/6 rounded bg-white/5" />
      </div>
      <div className="relative pl-8 space-y-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="relative flex gap-4">
            {/* Connector line */}
            {i < 4 && (
              <div className="absolute left-[-24px] top-8 bottom-[-32px] w-px bg-white/5" />
            )}
            {/* Circle */}
            <div className="absolute left-[-30px] top-1 w-6 h-6 rounded-full bg-white/10 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-white/10" />
              <div className="h-3 w-full rounded bg-white/5" />
              <div className="h-3 w-4/5 rounded bg-white/5" />
              <div className="flex gap-2 mt-2">
                <div className="h-5 w-20 rounded-full bg-white/5" />
                <div className="h-5 w-28 rounded-full bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step card on the timeline
// ─────────────────────────────────────────────────────────────

const STEP_COLORS = [
  { ring: 'border-cyan-400/60', bg: 'bg-cyan-500/10', text: 'text-cyan-400', dot: 'bg-cyan-400' },
  { ring: 'border-violet-400/60', bg: 'bg-violet-500/10', text: 'text-violet-400', dot: 'bg-violet-400' },
  { ring: 'border-amber-400/60', bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  { ring: 'border-emerald-400/60', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  { ring: 'border-pink-400/60', bg: 'bg-pink-500/10', text: 'text-pink-400', dot: 'bg-pink-400' },
  { ring: 'border-orange-400/60', bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400' },
  { ring: 'border-sky-400/60', bg: 'bg-sky-500/10', text: 'text-sky-400', dot: 'bg-sky-400' },
  { ring: 'border-rose-400/60', bg: 'bg-rose-500/10', text: 'text-rose-400', dot: 'bg-rose-400' },
];

function StepCard({
  step,
  isLast,
  onSelectSource,
}: {
  step: LearningStep;
  isLast: boolean;
  onSelectSource?: (sourceTitle: string, timestamp?: string) => void;
}) {
  const color = STEP_COLORS[(step.order - 1) % STEP_COLORS.length];

  return (
    <div className="relative flex gap-5">
      {/* Vertical connector */}
      {!isLast && (
        <div className="absolute left-[11px] top-8 bottom-[-24px] w-px bg-gradient-to-b from-white/15 to-transparent" />
      )}

      {/* Pinpoint circle */}
      <div
        className={`relative z-10 w-6 h-6 rounded-full border-2 ${color.ring} ${color.bg} flex items-center justify-center shrink-0 shadow-sm mt-0.5`}
      >
        <span className={`text-[10px] font-bold ${color.text}`}>{step.order}</span>
      </div>

      {/* Content card */}
      <div className="flex-1 pb-8">
        <div className={`rounded-xl border ${color.ring} ${color.bg} p-4 space-y-3 hover:bg-white/5 transition-colors`}>
          {/* Title + duration */}
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-white leading-snug">{step.title}</h4>
            <div className={`flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${color.bg} ${color.text} border ${color.ring}`}>
              <Clock className="w-2.5 h-2.5" />
              {step.estimatedDuration}
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-[#A9A9A9] leading-relaxed">{step.description}</p>

          {/* Key outcomes */}
          {step.keyOutcomes && step.keyOutcomes.length > 0 && (
            <div className="space-y-1">
              {step.keyOutcomes.map((outcome, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-[#A9A9A9]">
                  <CheckCircle2 className={`w-3 h-3 shrink-0 mt-0.5 ${color.text}`} />
                  <span>{outcome}</span>
                </div>
              ))}
            </div>
          )}

          {/* Interactive Source Tags */}
          {step.sources && step.sources.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <span className="text-[10px] uppercase font-semibold text-[#A9A9A9] tracking-wider flex items-center gap-1.5">
                <BookOpen className={`w-3 h-3 ${color.text}`} />
                <span>Attached Knowledge Sources</span>
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {step.sources.map((src, i) => {
                  const title = typeof src === 'string' ? src : src.title;
                  const tsRaw = typeof src === 'object' && src.timestamp ? src.timestamp : undefined;
                  const displayTs = tsRaw || 'Full Video';

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSelectSource?.(title, tsRaw)}
                      className="group/src flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-500/40 text-left transition-all duration-200 text-xs cursor-pointer w-full"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <BookOpen className={`w-3.5 h-3.5 ${color.text} shrink-0 group-hover/src:scale-110 transition-transform`} />
                        <span className="font-medium text-white/90 group-hover/src:text-cyan-300 truncate">
                          {title}
                        </span>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {displayTs}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#A9A9A9] group-hover/src:text-cyan-400 shrink-0 opacity-70 group-hover/src:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main dialog
// ─────────────────────────────────────────────────────────────

export function LearningPathDialog({
  isOpen,
  onClose,
  isGenerating,
  learningPath,
  onSelectSource,
}: LearningPathDialogProps) {
  const handleDownload = () => {
    if (!learningPath) return;
    const lines: string[] = [
      learningPath.title,
      '═'.repeat(60),
      '',
      learningPath.description,
      '',
      `Estimated total time: ${learningPath.estimatedTotalDuration}`,
      '',
      '─'.repeat(60),
      'LEARNING STEPS',
      '─'.repeat(60),
      '',
    ];

    for (const step of learningPath.steps) {
      lines.push(`Step ${step.order}: ${step.title}`);
      lines.push(`Duration: ${step.estimatedDuration}`);
      lines.push('');
      lines.push(step.description);
      lines.push('');
      if (step.keyOutcomes?.length) {
        lines.push('Key Outcomes:');
        step.keyOutcomes.forEach((o) => lines.push(`  ✓ ${o}`));
        lines.push('');
      }
      if (step.sources?.length) {
        lines.push('Sources:');
        step.sources.forEach((s) => {
          const t = typeof s === 'string' ? s : s.title;
          const ts = typeof s === 'object' && s.timestamp ? ` [${s.timestamp}]` : '';
          lines.push(`  📖 ${t}${ts}`);
        });
        lines.push('');
      }
      lines.push('─'.repeat(40));
      lines.push('');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${learningPath.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_learning_path.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      contentClassName="max-w-2xl w-full bg-[#141414] border border-[#2B2B2B] text-white p-0 overflow-hidden rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col"
    >
      {/* ── Header ── */}
      <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-[#2B2B2B] shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 shrink-0 mt-0.5">
              <GitCommit className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm sm:text-base font-semibold text-white leading-tight truncate">
                {isGenerating ? 'Building Learning Path…' : (learningPath?.title || 'Learning Path')}
              </DialogTitle>
              {learningPath && !isGenerating && (
                <p className="text-xs text-[#A9A9A9] mt-1 leading-relaxed">
                  {learningPath.description}
                </p>
              )}
            </div>
          </div>

          {learningPath && !isGenerating && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="h-8 text-xs gap-1.5 border-[#3A3A3A] text-[#A9A9A9] hover:text-white hover:border-cyan-500/50 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </Button>
          )}
        </div>

        {/* Meta row */}
        {isGenerating && (
          <div className="mt-3 flex items-center gap-2 text-xs text-cyan-400">
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
            <span>Structuring your personalised learning roadmap…</span>
          </div>
        )}

        {learningPath && !isGenerating && (
          <div className="mt-3 flex items-center gap-4 text-[11px] text-[#A9A9A9]">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span className="text-cyan-400">{learningPath.estimatedTotalDuration}</span>
              <span>estimated</span>
            </div>
            <div className="flex items-center gap-1.5">
              <GitCommit className="w-3 h-3 text-cyan-400" />
              <span>{learningPath.steps.length} steps</span>
            </div>
          </div>
        )}
      </DialogHeader>

      {/* ── Timeline content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 max-h-[calc(85vh-160px)] space-y-4">
        {isGenerating && !learningPath ? (
          <LearningPathSkeleton />
        ) : learningPath ? (
          <div className="relative pl-2 pb-4">
            {learningPath.steps.map((step, i) => (
              <StepCard
                key={step.order}
                step={step}
                isLast={i === learningPath.steps.length - 1}
                onSelectSource={onSelectSource}
              />
            ))}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
