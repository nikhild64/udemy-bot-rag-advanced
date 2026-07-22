"use client"

import { useUIStore } from '@/shared/lib/store';
import { NotebookList } from '@/features/notebooks/components/NotebookList';
import { Sparkles, Settings, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSettingsModalOpen = useUIStore((s) => s.setSettingsModalOpen);

  if (!sidebarOpen) return null;

  return (
    <aside className="w-64 border-r border-border bg-card/40 flex flex-col h-full shrink-0 transition-all duration-300">
      {/* Brand Header */}
      <div className="h-14 px-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <span>Notebook RAG</span>
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={toggleSidebar}
        >
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      {/* Notebook List */}
      <div className="flex-1 overflow-hidden p-3">
        <NotebookList />
      </div>

      {/* Footer Settings Button */}
      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-xs text-muted-foreground hover:text-foreground gap-2 h-8"
          onClick={() => setSettingsModalOpen(true)}
        >
          <Settings className="w-4 h-4" />
          <span>Workspace Settings</span>
        </Button>
      </div>
    </aside>
  );
}
