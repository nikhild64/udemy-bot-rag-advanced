"use client"

import { useState } from 'react';
import {
  useNotebooksQuery,
  useDuplicateNotebookMutation,
  useArchiveNotebookMutation,
  useFavoriteNotebookMutation,
} from '../hooks/useNotebooks';
import { useUIStore } from '@/shared/lib/store';
import { BookOpen, Plus, Search, MoreVertical, Edit2, Trash2, Copy, Star, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export function NotebookList() {
  const router = useRouter();
  const { data: notebooks, isLoading, isError, error } = useNotebooksQuery();
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const setActiveNotebookId = useUIStore((s) => s.setActiveNotebookId);
  const setCreateNotebookModalOpen = useUIStore((s) => s.setCreateNotebookModalOpen);
  const setEditingNotebook = useUIStore((s) => s.setEditingNotebook);
  const setDeletingNotebook = useUIStore((s) => s.setDeletingNotebook);

  const duplicateMutation = useDuplicateNotebookMutation();
  const archiveMutation = useArchiveNotebookMutation();
  const favoriteMutation = useFavoriteNotebookMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'favorites' | 'archived'>('all');

  const filteredNotebooks = (notebooks || []).filter((nb) => {
    const matchesSearch = nb.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === 'favorites') return nb.isFavorite && !nb.isArchived;
    if (filterTab === 'archived') return nb.isArchived;
    return !nb.isArchived;
  });

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

      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 border-b border-border/40 pb-2">
        {(['all', 'favorites', 'archived'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition',
              filterTab === tab
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            {tab}
          </button>
        ))}
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
            {searchQuery ? 'No matching notebooks found.' : 'No notebooks found in this view.'}
          </div>
        ) : (
          filteredNotebooks.map((nb) => {
            const isActive = activeNotebookId === nb.id;
            return (
              <div
                key={nb.id}
                onClick={() => {
                  setActiveNotebookId(nb.id);
                  router.push(`/notebooks/${nb.id}`);
                }}
                className={cn(
                  'group relative flex items-center justify-between p-2.5 rounded-lg text-sm cursor-pointer transition-all border border-transparent',
                  isActive
                    ? 'bg-primary/10 border-primary/20 text-primary font-medium shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {nb.isFavorite ? (
                    <Star className="w-4 h-4 shrink-0 text-amber-400 fill-amber-400" />
                  ) : (
                    <BookOpen className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  )}
                  <span className="truncate">{nb.title}</span>
                </div>

                <div className="shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu
                    align="right"
                    trigger={
                      <div className="p-1 hover:bg-muted/80 rounded-md text-muted-foreground hover:text-foreground transition-all">
                        <MoreVertical className="w-4 h-4" />
                      </div>
                    }
                  >
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        favoriteMutation.mutate({ id: nb.id, isFavorite: !nb.isFavorite });
                      }}
                    >
                      <Star className="w-3.5 h-3.5 mr-2 text-amber-400" />
                      {nb.isFavorite ? 'Unfavorite' : 'Favorite'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateMutation.mutate(nb.id);
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        archiveMutation.mutate({ id: nb.id, archive: !nb.isArchived });
                      }}
                    >
                      <Archive className="w-3.5 h-3.5 mr-2" />
                      {nb.isArchived ? 'Restore' : 'Archive'}
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
