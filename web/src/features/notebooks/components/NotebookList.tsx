"use client"

import { useState } from 'react';
import { useNotebooksQuery } from '../hooks/useNotebooks';
import { useUIStore } from '@/shared/lib/store';
import { BookOpen, Plus, Search, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function NotebookList() {
  const { data: notebooks, isLoading, isError, error } = useNotebooksQuery();
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const setActiveNotebookId = useUIStore((s) => s.setActiveNotebookId);
  const setCreateNotebookModalOpen = useUIStore((s) => s.setCreateNotebookModalOpen);
  const setEditingNotebook = useUIStore((s) => s.setEditingNotebook);
  const setDeletingNotebook = useUIStore((s) => s.setDeletingNotebook);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotebooks = (notebooks || []).filter((nb) =>
    nb.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Header & Create Button */}
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notebooks</h2>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs flex items-center gap-1 hover:bg-accent"
          onClick={() => setCreateNotebookModalOpen(true)}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New</span>
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative px-2">
        <Search className="absolute left-4 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Filter notebooks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 pl-8 text-xs bg-muted/40"
        />
      </div>

      {/* Notebook List */}
      <div className="flex-1 overflow-y-auto px-1 space-y-1">
        {isLoading ? (
          <div className="space-y-2 px-1">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : isError ? (
          <div className="p-3 text-xs text-destructive bg-destructive/10 rounded-lg">
            Failed to load notebooks: {(error as any)?.message || 'Unknown error'}
          </div>
        ) : filteredNotebooks.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {searchQuery ? 'No matching notebooks found.' : 'No notebooks yet. Click "New" to create one.'}
          </div>
        ) : (
          filteredNotebooks.map((nb) => {
            const isActive = activeNotebookId === nb.id;
            return (
              <div
                key={nb.id}
                onClick={() => setActiveNotebookId(nb.id)}
                className={cn(
                  'group relative flex items-center justify-between p-2.5 rounded-lg text-sm cursor-pointer transition-all border border-transparent',
                  isActive
                    ? 'bg-primary/10 border-primary/20 text-primary font-medium shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-6">
                  <BookOpen className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="truncate">{nb.title}</span>
                </div>

                <div className="absolute right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu
                    trigger={
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    }
                  >
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNotebook({ id: nb.id, title: nb.title, description: nb.description });
                      }}
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      destructive
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingNotebook({ id: nb.id, title: nb.title });
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
