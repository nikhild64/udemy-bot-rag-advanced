"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUserMemoriesQuery, useAddUserMemoryMutation, useDeleteUserMemoryMutation, useClearAllUserMemoriesMutation } from '../hooks/useMemory';
import { Brain, Plus, Trash2, Search, Sparkles, Loader2, X, AlertCircle, AlertTriangle } from 'lucide-react';

interface UserMemoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserMemoryModal({ open, onOpenChange }: UserMemoryDrawerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [newMemory, setNewMemory] = useState('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: memories = [], isLoading, isRefetching, refetch } = useUserMemoriesQuery();
  const addMutation = useAddUserMemoryMutation();
  const deleteMutation = useDeleteUserMemoryMutation();
  const clearAllMutation = useClearAllUserMemoriesMutation();

  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemory.trim()) return;
    await addMutation.mutateAsync(newMemory.trim());
    setNewMemory('');
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleClearAll = () => {
    setShowConfirmClear(true);
  };

  const filteredMemories = memories.filter((m) =>
    m.memory.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-300"
        onClick={() => onOpenChange(false)}
      />

      {/* Right Drawer Container */}
      <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pl-10">
        <div className="w-screen max-w-md bg-[#141416] border-l border-[#2A2A2E] text-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ease-out">
          
          {/* Drawer Header */}
          <div className="p-5 border-b border-[#2A2A2E] flex items-center justify-between bg-[#18181C]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#F2A23A]/10 border border-[#F2A23A]/20 text-[#F2A23A]">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  AI Personal Memory
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Personal facts & preferences across sessions
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
              title="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            
            {/* Manual Memory Form */}
            <form onSubmit={handleAdd} className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F2A23A]" />
                Add Custom Memory / Preference
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., I prefer TypeScript over JavaScript with concise steps"
                  value={newMemory}
                  onChange={(e) => setNewMemory(e.target.value)}
                  className="flex-1 bg-[#1C1C20] border border-zinc-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#F2A23A] transition"
                />
                <button
                  type="submit"
                  disabled={!newMemory.trim() || addMutation.isPending}
                  className="bg-[#F2A23A] hover:bg-[#e09129] text-black font-semibold px-3.5 py-2 rounded-lg text-xs transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add
                </button>
              </div>
            </form>

            <div className="border-t border-[#2A2A2E] pt-4">
              {/* Sync Processing Disclaimer */}
              <div className="bg-[#1C1C20] border border-amber-500/20 rounded-lg p-2.5 flex items-start gap-2 text-xs text-amber-200/90 mb-3">
                <AlertCircle className="w-4 h-4 text-[#F2A23A] shrink-0 mt-0.5" />
                <span>
                  <strong>Note:</strong> Memory preferences are processed asynchronously by our memory engine. Modifications or deletions may take a few seconds to fully sync.
                </span>
              </div>

              {/* Search & Stats Header */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Filter memories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#1C1C20] border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {memories.length} {memories.length === 1 ? 'fact' : 'facts'}
                  </span>
                  {memories.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      disabled={clearAllMutation.isPending}
                      className="text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md transition flex items-center gap-1"
                      title="Clear all personal memories"
                    >
                      {clearAllMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Memory List */}
              <div className="space-y-2.5">
                {isLoading || isRefetching ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#F2A23A]" />
                    <span className="text-xs">Fetching memories...</span>
                  </div>
                ) : filteredMemories.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-zinc-800/80 rounded-xl bg-[#18181B]/40 p-4">
                    <Brain className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
                    <p className="text-xs font-semibold text-zinc-300">No active memories stored</p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      As you converse with ChaibookLM, facts and preferences are automatically learned and stored here.
                    </p>
                  </div>
                ) : (
                  filteredMemories.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-start justify-between gap-3 p-3 bg-[#1C1C20] border border-zinc-800/80 hover:border-[#F2A23A]/40 rounded-xl transition duration-200"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-200 leading-relaxed font-medium">
                          {item.memory}
                        </p>
                        {item.createdAt && (
                          <span className="text-[10px] text-zinc-500 mt-1 block font-mono">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deleteMutation.isPending}
                        className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition opacity-70 group-hover:opacity-100 shrink-0"
                        title="Delete Memory"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-[#2A2A2E] bg-[#18181C] text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Privacy-First Memory Engine</span>
            <button
              onClick={() => onOpenChange(false)}
              className="text-zinc-300 hover:text-white font-medium underline"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal for Clear All */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#18181C] border border-rose-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-white animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Clear All Memories?</h3>
                <p className="text-xs text-zinc-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed bg-[#1C1C20] border border-zinc-800 p-3 rounded-xl">
              Are you sure you want to clear all your personal AI memories and preferences across all sessions?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmClear(false);
                  clearAllMutation.mutate();
                }}
                disabled={clearAllMutation.isPending}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-lg shadow-rose-900/30 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {clearAllMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
