"use client"

import { useUIStore } from '@/shared/lib/store';
import { useNotebookQuery } from '@/features/notebooks/hooks/useNotebooks';
import { UserButton, SignInButton, useAuth } from '@clerk/nextjs';
import { PanelLeft, PanelRight, Settings, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function Header() {
  const { isSignedIn, isLoaded } = useAuth();
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleSourcesPanel = useUIStore((s) => s.toggleSourcesPanel);
  const sourcesPanelOpen = useUIStore((s) => s.sourcesPanelOpen);
  const setSettingsModalOpen = useUIStore((s) => s.setSettingsModalOpen);

  const { data: notebook } = useNotebookQuery(activeNotebookId);

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
      {/* Left section: Sidebar toggle & Notebook info */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={toggleSidebar}
          title="Toggle Navigation Sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </Button>

        {notebook ? (
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-4 h-4 text-primary shrink-0" />
            <h1 className="text-sm font-semibold text-foreground truncate">{notebook.title}</h1>
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 hidden sm:inline-flex">
              Notebook
            </Badge>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">AI Notebook Platform</span>
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
