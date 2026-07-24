"use client"

import { useUIStore } from '@/shared/lib/store';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { SourceList } from '@/features/sources/components/SourceList';
import { CreateNotebookModal } from '@/features/notebooks/components/CreateNotebookModal';
import { RenameNotebookModal } from '@/features/notebooks/components/RenameNotebookModal';
import { DeleteNotebookModal } from '@/features/notebooks/components/DeleteNotebookModal';
import { UploadModal } from '@/features/upload/components/UploadModal';
import { SettingsModal } from '@/features/settings/components/SettingsModal';
import { setAuthTokenGetter } from '@/shared/api/client';
import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
  hideSources?: boolean;
  hideNotebookInfo?: boolean;
}

export function AppLayout({
  children,
  hideSidebar = false,
  hideSources = false,
  hideNotebookInfo = false,
}: AppLayoutProps) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const sourcesPanelOpen = useUIStore((s) => s.sourcesPanelOpen);
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const settingsModalOpen = useUIStore((s) => s.settingsModalOpen);
  const setSettingsModalOpen = useUIStore((s) => s.setSettingsModalOpen);

  // Set up token getter for API client as soon as auth is ready
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setAuthTokenGetter(async () => {
        return getToken();
      });
    }
  }, [getToken, isLoaded, isSignedIn]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background selection:bg-primary/20">
      {/* Navigation Sidebar */}
      {!hideSidebar && <Sidebar />}

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <Header
          hideSidebarToggle={hideSidebar}
          hideSourcesToggle={hideSources}
          hideNotebookInfo={hideNotebookInfo || hideSidebar}
        />

        <div className="flex-1 flex h-full min-h-0 overflow-hidden">
          {/* Main Content Area (Chat/Dashboard) */}
          <main className="flex-1 flex flex-col h-full min-w-0 relative overflow-hidden">
            {children}
          </main>

          {/* Right Sources Drawer Panel */}
          {!hideSources && activeNotebookId && sourcesPanelOpen && (
            <aside className="w-80 border-l border-border bg-card/30 flex flex-col h-full p-4 shrink-0 overflow-hidden animate-in slide-in-from-right-4 duration-200">
              <SourceList />
            </aside>
          )}
        </div>
      </div>

      {/* Global Modals */}
      <CreateNotebookModal />
      <RenameNotebookModal />
      <DeleteNotebookModal />
      <UploadModal />
      <SettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
    </div>
  );
}
