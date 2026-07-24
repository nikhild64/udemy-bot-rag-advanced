"use client";

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface ProRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

export function ProRequiredModal({ isOpen, onClose, featureName = 'Re-creating AI Artifacts' }: ProRequiredModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} contentClassName="max-w-md w-full border-amber-500/40">
      <DialogHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-foreground">
              PRO Entitlement Required
            </DialogTitle>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold mt-0.5">
              PRO Account Feature
            </span>
          </div>
        </div>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
          <span className="font-semibold text-foreground">{featureName}</span> is reserved for <span className="font-semibold text-amber-400">PRO users</span>.
        </DialogDescription>
      </DialogHeader>

      <div className="my-3 p-3.5 rounded-xl bg-muted/40 border border-border space-y-2 text-xs">
        <p className="text-muted-foreground leading-relaxed">
          Non-Pro accounts can generate podcasts and learning timelines once. Re-creating or refreshing existing AI artifacts requires a PRO subscription. Please contact your admin to upgrade.
        </p>
      </div>

      <DialogFooter className="gap-2 sm:gap-0 mt-4">
        <Button variant="outline" size="sm" onClick={onClose}>
          Got it
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
