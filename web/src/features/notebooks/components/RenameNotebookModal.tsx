"use client"

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUIStore } from '@/shared/lib/store';
import { useUpdateNotebookMutation } from '../hooks/useNotebooks';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const renameNotebookSchema = z.object({
  title: z.string().min(1, 'Notebook title is required').max(100, 'Title is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
});

type RenameNotebookFormValues = z.infer<typeof renameNotebookSchema>;

export function RenameNotebookModal() {
  const editingNotebook = useUIStore((s) => s.editingNotebook);
  const setEditingNotebook = useUIStore((s) => s.setEditingNotebook);
  const updateMutation = useUpdateNotebookMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RenameNotebookFormValues>({
    resolver: zodResolver(renameNotebookSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  useEffect(() => {
    if (editingNotebook) {
      reset({
        title: editingNotebook.title || '',
        description: editingNotebook.description || '',
      });
    }
  }, [editingNotebook, reset]);

  const onSubmit = (data: RenameNotebookFormValues) => {
    if (!editingNotebook) return;
    updateMutation.mutate({
      id: editingNotebook.id,
      data,
    });
  };

  return (
    <Dialog open={!!editingNotebook} onOpenChange={(open) => !open && setEditingNotebook(null)}>
      <DialogHeader>
        <DialogTitle>Rename Notebook</DialogTitle>
        <DialogDescription>Update the title and description for this notebook.</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Notebook Title</label>
          <Input {...register('title')} placeholder="Notebook Title" autoFocus />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Description</label>
          <Input {...register('description')} placeholder="Description (optional)" />
          {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setEditingNotebook(null)}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
