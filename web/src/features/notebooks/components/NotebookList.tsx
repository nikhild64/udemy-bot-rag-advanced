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

import { useUserProfileQuery } from '@/shared/hooks/useUserProfile';

interface NotebookListProps {
  isMobile?: boolean;
}

export function NotebookList({ isMobile }: NotebookListProps) {
  const router = useRouter();
  const { data: notebooks, isLoading, isError, error } = useNotebooksQuery();
  const { data: userProfile } = useUserProfileQuery();
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const setActiveNotebookId = useUIStore((s) => s.setActiveNotebookId);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const setCreateNotebookModalOpen = useUIStore((s) => s.setCreateNotebookModalOpen);
  const setNotebookLimitModalOpen = useUIStore((s) => s.setNotebookLimitModalOpen);
  const setEditingNotebook = useUIStore((s) => s.setEditingNotebook);
  const setDeletingNotebook = useUIStore((s) => s.setDeletingNotebook);

  const duplicateMutation = useDuplicateNotebookMutation();
  const archiveMutation = useArchiveNotebookMutation();
  const favoriteMutation = useFavoriteNotebookMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'favorites' | 'archived'>('all');

  const handleCreateClick = () => {
    if (isMobile) setMobileSidebarOpen(false);
    const activeCount = (notebooks || []).filter((nb) => !nb.isArchived).length;
    if (!userProfile?.isPro && activeCount >= 2) {
      setNotebookLimitModalOpen(true);
    } else {
      setCreateNotebookModalOpen(true);
    }
  };

  const filteredNotebooks = (notebooks || []).filter((nb) => {
    const matchesSearch = nb.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === 'favorites') return nb.isFavorite && !nb.isArchived;
    if (filterTab === 'archived') return nb.isArchived;
    return !nb.isArchived;
  });

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Header row */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#686868]">Notebooks</span>
        <button
          onClick={handleCreateClick}
          className="h-6 w-6 flex items-center justify-center rounded-md bg-[#F2A23A]/15 text-[#F2A23A] hover:bg-[#F2A23A]/25 transition-colors cursor-pointer border-none"
          title="New notebook"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Search */}
      <div className="relative px-0.5">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#585858]" />
        <input
          type="text"
          placeholder="Search…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-7 pl-7 pr-2 text-[11px] bg-[#161616] border border-[#252525] rounded-md text-[#c8c8c8] placeholder-[#505050] focus:outline-none focus:border-[#F2A23A]/50 transition-colors"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 px-0.5">
        {(['all', 'favorites', 'archived'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={cn(
              'flex-1 py-1 rounded-md text-[10px] font-medium capitalize transition-colors cursor-pointer border-none',
              filterTab === tab
                ? 'bg-[#1e1e1e] text-[#F2A23A] font-semibold'
                : 'text-[#585858] hover:text-[#888] hover:bg-[#141414]'
            )}
          >
            {tab === 'all' ? 'All' : tab === 'favorites' ? '★ Fav' : '⊞ Arc'}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-[#1e1e1e] mx-0.5" />

      {/* Notebook List */}
      <div className="flex-1 overflow-y-auto px-0.5 space-y-0.5">
        {isLoading ? (
          <div className="space-y-1 px-0.5">
            <div className="h-9 w-full rounded-md bg-[#181818] animate-pulse" />
            <div className="h-9 w-full rounded-md bg-[#181818] animate-pulse" />
            <div className="h-9 w-full rounded-md bg-[#181818] animate-pulse" />
          </div>
        ) : isError ? (
          <div className="p-2 text-[10px] text-red-400 bg-red-500/8 border border-red-500/15 rounded-md leading-relaxed">
            Failed to load: {(error as any)?.message || 'Unknown error'}
          </div>
        ) : filteredNotebooks.length === 0 ? (
          <div className="p-3 text-center text-[10px] text-[#505050]">
            {searchQuery ? 'No matches' : 'Empty'}
          </div>
        ) : (
          filteredNotebooks.map((nb) => {
            const isActive = activeNotebookId === nb.id;
            return (
              <div
                key={nb.id}
                onClick={() => {
                  setActiveNotebookId(nb.id);
                  if (isMobile) setMobileSidebarOpen(false);
                  router.push(`/notebooks/${nb.id}`);
                }}
                className={cn(
                  'group relative flex items-center gap-2 px-2 py-[7px] rounded-md text-[12px] cursor-pointer transition-all',
                  isActive
                    ? 'bg-[#F2A23A]/10 text-[#F2A23A] font-medium'
                    : 'text-[#909090] hover:bg-[#161616] hover:text-[#c8c8c8]'
                )}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-[#F2A23A]" />
                )}

                {nb.isFavorite ? (
                  <Star className="w-3.5 h-3.5 shrink-0 text-[#F2A23A] fill-[#F2A23A]/80" />
                ) : (
                  <BookOpen className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-[#F2A23A]/70' : 'text-[#484848]')} />
                )}
                <span className="truncate flex-1 leading-tight">{nb.title}</span>

                {/* Context menu — visible on hover or when active */}
                <div
                  className={cn(
                    'shrink-0 transition-opacity',
                    isActive ? 'opacity-60' : 'opacity-0 group-hover:opacity-60'
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu
                    align="right"
                    trigger={
                      <div className="p-0.5 hover:bg-white/5 rounded text-inherit hover:text-white transition-all">
                        <MoreVertical className="w-3.5 h-3.5" />
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
  );
}
