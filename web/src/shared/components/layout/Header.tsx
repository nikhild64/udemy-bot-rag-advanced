"use client"

import { useUIStore } from '@/shared/lib/store';
import { useNotebookQuery, useDuplicateNotebookMutation, useArchiveNotebookMutation, useFavoriteNotebookMutation } from '@/features/notebooks/hooks/useNotebooks';
import { useAdminStatusQuery } from '@/features/admin/hooks/useAdminLogs';
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
  Terminal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  hideSidebarToggle?: boolean;
  hideSourcesToggle?: boolean;
  hideNotebookInfo?: boolean;
}

export function Header({
  hideSidebarToggle = false,
  hideSourcesToggle = false,
  hideNotebookInfo = false,
}: HeaderProps) {
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
  const { data: adminStatus } = useAdminStatusQuery();

  const handleGoHome = () => {
    setActiveNotebookId(null);
    router.push('/');
  };

  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen);
  const toggleMobileSidebar = useUIStore((s) => s.toggleMobileSidebar);
  const mobileSourcesPanelOpen = useUIStore((s) => s.mobileSourcesPanelOpen);
  const toggleMobileSourcesPanel = useUIStore((s) => s.toggleMobileSourcesPanel);

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0">
      {/* Left section: Sidebar toggle & Notebook info + actions */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {!hideSidebarToggle && (
          <>
            {/* Desktop toggle button (shows when sidebar collapsed) */}
            {!sidebarOpen && (
              <Button
                size="icon"
                variant="ghost"
                className="hidden md:flex h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                onClick={toggleSidebar}
                title="Open Navigation Sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </Button>
            )}
            {/* Mobile toggle button (always available on mobile) */}
            <Button
              size="icon"
              variant="ghost"
              className="flex md:hidden h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
              onClick={toggleMobileSidebar}
              title="Open Navigation Sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </Button>
          </>
        )}

        <div
          onClick={handleGoHome}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition shrink-0"
          title="Go to Dashboard"
        >
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className={`text-sm font-semibold text-foreground ${notebook && !hideNotebookInfo ? 'hidden sm:inline' : 'inline'}`}>
            ChaibookLM
          </span>
        </div>

        {!hideNotebookInfo && notebook && (
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 border-l border-border/50 pl-2 sm:pl-3">
            <BookOpen className="w-4 h-4 text-primary shrink-0" />
            <h1 className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs">{notebook.title}</h1>
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 hidden lg:inline-flex">
              Notebook
            </Badge>

            {/* Individual Notebook Actions Dropdown */}
            <DropdownMenu
              align="left"
              trigger={
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
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
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {!hideSourcesToggle && activeNotebookId && (
          <>
            {/* Desktop Sources Toggle */}
            <Button
              size="sm"
              variant={sourcesPanelOpen ? 'secondary' : 'ghost'}
              className="hidden md:flex h-8 text-xs gap-1.5"
              onClick={toggleSourcesPanel}
              title="Toggle Knowledge Sources Panel"
            >
              <PanelRight className="w-4 h-4" />
              <span>Sources</span>
            </Button>
            {/* Mobile Sources Toggle */}
            <Button
              size="sm"
              variant={mobileSourcesPanelOpen ? 'secondary' : 'ghost'}
              className="flex md:hidden h-8 text-xs gap-1.5 px-2"
              onClick={toggleMobileSourcesPanel}
              title="Toggle Knowledge Sources Panel"
            >
              <PanelRight className="w-4 h-4" />
              <span className="hidden xs:inline text-[11px]">Sources</span>
            </Button>
          </>
        )}

        {isSignedIn && adminStatus?.data?.isAdmin && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/admin/logs')}
            title="Admin System Logs"
          >
            <Terminal className="w-4 h-4 text-primary/80 hover:text-primary" />
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
