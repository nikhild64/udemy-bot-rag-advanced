'use client';

import { useState } from 'react';
import {
  useNotebooksQuery,
  useDuplicateNotebookMutation,
  useArchiveNotebookMutation,
  useFavoriteNotebookMutation,
} from '../hooks/useNotebooks';
import { useUIStore } from '@/shared/lib/store';
import { BookOpen, Plus, Search, MoreVertical, Edit2, Trash2, Copy, Star, Archive } from 'lucide-react';
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
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
        .nb-tab-active {
          background: color-mix(in oklch, #F2A23A 15%, transparent);
          color: #F2A23A;
          font-weight: 600;
        }
        .nb-item-active {
          background: color-mix(in oklch, #F2A23A 12%, #1A1A1A);
          border-color: color-mix(in oklch, #F2A23A 30%, transparent);
          color: #F2A23A;
        }
      `}} />
      <div className="flex flex-col h-full space-y-3">
        {/* Header & Create Button */}
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#A9A9A9]">Notebooks</h2>
          <button
            onClick={() => setCreateNotebookModalOpen(true)}
            className="h-7 px-2.5 text-xs flex items-center gap-1.5 rounded-full bg-[#F2A23A] text-[#121212] font-semibold hover:bg-[#e09229] transition cursor-pointer border-none"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-2 border-b border-[#2B2B2B] pb-2">
          {(['all', 'favorites', 'archived'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition cursor-pointer border-none',
                filterTab === tab
                  ? 'nb-tab-active'
                  : 'text-[#A9A9A9] hover:bg-[#232323] hover:text-white'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative px-2">
          <Search className="absolute left-4 top-2.5 h-3.5 w-3.5 text-[#A9A9A9]" />
          <input
            type="text"
            placeholder="Filter notebooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs bg-[#1A1A1A] border border-[#2B2B2B] rounded-lg text-white placeholder-[#A9A9A9] focus:outline-none focus:border-[#F2A23A]"
          />
        </div>

        {/* Notebook List */}
        <div className="flex-1 overflow-y-auto px-1 space-y-1">
          {isLoading ? (
            <div className="space-y-2 px-1">
              <div className="h-10 w-full rounded-lg bg-[#232323] animate-pulse" />
              <div className="h-10 w-full rounded-lg bg-[#232323] animate-pulse" />
              <div className="h-10 w-full rounded-lg bg-[#232323] animate-pulse" />
            </div>
          ) : isError ? (
            <div className="p-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
              Failed to load notebooks: {(error as any)?.message || 'Unknown error'}
            </div>
          ) : filteredNotebooks.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#A9A9A9]">
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
                      ? 'nb-item-active font-semibold shadow-xs'
                      : 'text-[#A9A9A9] hover:bg-[#1A1A1A] hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {nb.isFavorite ? (
                      <Star className="w-4 h-4 shrink-0 text-[#F2A23A] fill-[#F2A23A]" />
                    ) : (
                      <BookOpen className={cn('w-4 h-4 shrink-0', isActive ? 'text-[#F2A23A]' : 'text-[#A9A9A9]')} />
                    )}
                    <span className="truncate">{nb.title}</span>
                  </div>

                  <div className="shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      align="right"
                      trigger={
                        <div className="p-1 hover:bg-[#232323] rounded-md text-[#A9A9A9] hover:text-white transition-all">
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
                        <Star className="w-3.5 h-3.5 mr-2 text-[#F2A23A]" />
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
    </>
  );
}
