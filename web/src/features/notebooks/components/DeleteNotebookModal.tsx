"use client"

import { useUIStore } from '@/shared/lib/store';
import { useDeleteNotebookMutation } from '../hooks/useNotebooks';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';

export function DeleteNotebookModal() {
  const deletingNotebook = useUIStore((s) => s.deletingNotebook);
  const setDeletingNotebook = useUIStore((s) => s.setDeletingNotebook);
  const deleteMutation = useDeleteNotebookMutation();

  if (!deletingNotebook) return null;

  const handleDelete = () => {
    deleteMutation.mutate(deletingNotebook.id);
  };

  return (
    <Dialog open={!!deletingNotebook} onOpenChange={(open) => !open && setDeletingNotebook(null)}>
      <DialogHeader className="space-y-2">
        <DialogTitle className="flex items-center gap-2 text-destructive text-base font-semibold">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>Delete Notebook</span>
        </DialogTitle>
        <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
          Are you sure you want to delete <span className="font-semibold text-foreground">"{deletingNotebook.title}"</span>?
          All associated knowledge sources, vector embeddings, generated audio podcasts, learning roadmaps, and chat history will be permanently deleted. This action cannot be undone.
        </DialogDescription>
      </DialogHeader>

      <DialogFooter className="gap-2 sm:gap-0 mt-4">
        <Button variant="outline" size="sm" onClick={() => setDeletingNotebook(null)}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
          {deleteMutation.isPending ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Deleting...
            </span>
          ) : (
            'Delete Notebook'
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
