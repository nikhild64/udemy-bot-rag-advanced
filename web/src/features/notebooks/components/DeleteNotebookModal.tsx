"use client"

import { useUIStore } from '@/shared/lib/store';
import { useDeleteNotebookMutation } from '../hooks/useNotebooks';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
      <DialogHeader>
        <DialogTitle className="text-destructive">Delete Notebook</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete <span className="font-semibold text-foreground">"{deletingNotebook.title}"</span>?
          All associated sources, embeddings, and chat history will be permanently deleted. This action cannot be undone.
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button variant="outline" onClick={() => setDeletingNotebook(null)}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
          {deleteMutation.isPending ? 'Deleting...' : 'Delete Notebook'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
