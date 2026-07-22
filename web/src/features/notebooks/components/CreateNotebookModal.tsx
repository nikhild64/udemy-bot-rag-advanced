"use client font"

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUIStore } from '@/shared/lib/store';
import { useCreateNotebookMutation } from '../hooks/useNotebooks';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const createNotebookSchema = z.object({
  title: z.string().min(1, 'Notebook title is required').max(100, 'Title is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
});

type CreateNotebookFormValues = z.infer<typeof createNotebookSchema>;

export function CreateNotebookModal() {
  const isOpen = useUIStore((s) => s.createNotebookModalOpen);
  const setOpen = useUIStore((s) => s.setCreateNotebookModalOpen);
  const createMutation = useCreateNotebookMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateNotebookFormValues>({
    resolver: zodResolver(createNotebookSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  const onSubmit = (data: CreateNotebookFormValues) => {
    createMutation.mutate(data, {
      onSuccess: () => reset(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogHeader>
        <DialogTitle>Create New Notebook</DialogTitle>
        <DialogDescription>
          Give your notebook a name and optional description to start adding sources and asking questions.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Notebook Title</label>
          <Input
            {...register('title')}
            placeholder="e.g. Expo Mobile Architecture"
            autoFocus
          />
          {errors.title && (
            <p className="text-xs text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Description (Optional)</label>
          <Input
            {...register('description')}
            placeholder="e.g. Deep dive into React Native, Expo Router, and Native Modules"
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Notebook'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
