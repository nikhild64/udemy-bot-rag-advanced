"use client"

import { useUIStore } from '@/shared/lib/store';
import {
  useNotebookQuery,
  useDuplicateNotebookMutation,
  useArchiveNotebookMutation,
  useFavoriteNotebookMutation,
} from '@/features/notebooks/hooks/useNotebooks';
import { UserButton, SignInButton, useAuth } from '@clerk/nextjs';
import {
  PanelLeft,
  PanelRight,
  Settings,
  BookOpen,
  Sparkles,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Star,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';

export function Header() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const setActiveNotebookId = useUIStore((s) => s.setActiveNotebookId);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleSourcesPanel = useUIStore((s) => s.toggleSourcesPanel);
  const sourcesPanelOpen = useUIStore((s) => s.sourcesPanelOpen);
  const setSettingsModalOpen = useUIStore((s) => s.setSettingsModalOpen);
  const setEditingNotebook = useUIStore((s) => s.setEditingNotebook);
  const setDeletingNotebook = useUIStore((s) => s.setDeletingNotebook);

  const duplicateMutation = useDuplicateNotebookMutation();
  const archiveMutation = useArchiveNotebookMutation();
  const favoriteMutation = useFavoriteNotebookMutation();

  const { data: notebook } = useNotebookQuery(activeNotebookId);

  const handleGoHome = () => {
    setActiveNotebookId(null);
    router.push('/');
  };

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
      {/* Left section: Sidebar toggle & Notebook info + actions */}
      <div className="flex items-center gap-3 min-w-0">
        {!sidebarOpen && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={toggleSidebar}
            title="Open Navigation Sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </Button>
        )}

        {!sidebarOpen && (
          <div
            onClick={handleGoHome}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition shrink-0"
            title="Go to Dashboard"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">ChaibookLM</span>
          </div>
        )}

        {notebook && (
          <div className={`flex items-center gap-2 min-w-0 ${!sidebarOpen ? 'border-l border-border/50 pl-3' : ''}`}>
            <BookOpen className="w-4 h-4 text-primary shrink-0" />
            <h1 className="text-sm font-semibold text-foreground truncate">{notebook.title}</h1>
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 hidden sm:inline-flex">
              Notebook
            </Badge>

            {/* Individual Notebook Actions Dropdown */}
            <DropdownMenu
              align="left"
              trigger={
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Notebook Options"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              }
            >
              <DropdownMenuItem
                onClick={() => favoriteMutation.mutate({ id: notebook.id, isFavorite: !notebook.isFavorite })}
              >
                <Star className="w-3.5 h-3.5 mr-2 text-amber-400" />
                {notebook.isFavorite ? 'Unfavorite Notebook' : 'Favorite Notebook'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => duplicateMutation.mutate(notebook.id)}
              >
                <Copy className="w-3.5 h-3.5 mr-2" />
                Duplicate Notebook
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setEditingNotebook({ id: notebook.id, title: notebook.title, description: notebook.description })}
              >
                <Edit2 className="w-3.5 h-3.5 mr-2" />
                Rename Notebook
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => archiveMutation.mutate({ id: notebook.id, archive: !notebook.isArchived })}
              >
                <Archive className="w-3.5 h-3.5 mr-2" />
                {notebook.isArchived ? 'Restore Notebook' : 'Archive Notebook'}
              </DropdownMenuItem>
              <DropdownMenuItem
                destructive
                onClick={() => setDeletingNotebook({ id: notebook.id, title: notebook.title })}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Delete Notebook
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Right section: Sources toggle, Settings, User Profile */}
      <div className="flex items-center gap-2">
        {activeNotebookId && (
          <Button
            size="sm"
            variant={sourcesPanelOpen ? 'secondary' : 'ghost'}
            className="h-8 text-xs gap-1.5"
            onClick={toggleSourcesPanel}
            title="Toggle Knowledge Sources Panel"
          >
            <PanelRight className="w-4 h-4" />
            <span className="hidden sm:inline">Sources</span>
          </Button>
        )}

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setSettingsModalOpen(true)}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </Button>

        <div className="pl-2 border-l border-border flex items-center">
          {isLoaded && isSignedIn ? (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-7 h-7',
                },
              }}
            />
          ) : isLoaded ? (
            <SignInButton mode="modal">
              <Button size="sm" className="h-7 text-xs">
                Sign In
              </Button>
            </SignInButton>
          ) : null}
        </div>
      </div>
    </header>
  );
}
