"use client";

import { useUIStore } from '@/shared/lib/store';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, Info } from 'lucide-react';

export function NotebookLimitModal() {
  const isOpen = useUIStore((s) => s.notebookLimitModalOpen);
  const setOpen = useUIStore((s) => s.setNotebookLimitModalOpen);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen} contentClassName="max-w-md w-full border-amber-500/30">
      <DialogHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-foreground">Notebook Limit Reached</DialogTitle>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-amber-500 font-semibold mt-0.5">
              Free Tier Limit: 2 Notebooks
            </span>
          </div>
        </div>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
          You have reached the maximum allowed limit of <span className="font-semibold text-foreground">2 notebooks</span> for free tier accounts.
        </DialogDescription>
      </DialogHeader>

      <div className="my-3 p-3.5 rounded-xl bg-muted/40 border border-border space-y-2 text-xs">
        <div className="flex items-start gap-2 text-muted-foreground">
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Please <span className="font-semibold text-foreground">contact your admin</span> to increase your account limit or upgrade to a <span className="font-semibold text-amber-500">PRO plan</span>.
          </p>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0 mt-4">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
