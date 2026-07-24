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

  // Set up token getter for API client immediately as soon as auth is ready
  if (isLoaded && isSignedIn) {
    setAuthTokenGetter(async () => {
      return getToken();
    });
  }

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setAuthTokenGetter(async () => {
        return getToken();
      });
    }
  }, [getToken, isLoaded, isSignedIn]);

  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const mobileSourcesPanelOpen = useUIStore((s) => s.mobileSourcesPanelOpen);
  const setMobileSourcesPanelOpen = useUIStore((s) => s.setMobileSourcesPanelOpen);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background selection:bg-primary/20">
      {/* Desktop Navigation Sidebar */}
      {!hideSidebar && (
        <div className="hidden md:flex h-full shrink-0">
          <Sidebar />
        </div>
      )}

      {/* Mobile Sidebar Overlay Drawer */}
      {!hideSidebar && mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-50 w-72 h-full bg-background border-r border-border shadow-2xl animate-in slide-in-from-left duration-200">
            <Sidebar isMobile />
          </div>
        </div>
      )}

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <Header
          hideSidebarToggle={hideSidebar}
          hideSourcesToggle={hideSources}
          hideNotebookInfo={hideNotebookInfo || hideSidebar}
        />

        <div className="flex-1 flex h-full min-h-0 overflow-hidden relative">
          {/* Main Content Area (Chat/Dashboard) */}
          <main className="flex-1 flex flex-col h-full min-w-0 relative overflow-hidden">
            {children}
          </main>

          {/* Desktop Right Sources Drawer Panel */}
          {!hideSources && activeNotebookId && sourcesPanelOpen && (
            <aside className="hidden md:flex w-80 border-l border-border bg-card/30 flex-col h-full p-4 shrink-0 overflow-hidden animate-in slide-in-from-right-4 duration-200">
              <SourceList />
            </aside>
          )}

          {/* Mobile Right Sources Drawer Overlay */}
          {!hideSources && activeNotebookId && mobileSourcesPanelOpen && (
            <div className="fixed inset-0 z-50 flex justify-end md:hidden">
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
                onClick={() => setMobileSourcesPanelOpen(false)}
              />
              <aside className="relative z-50 w-80 max-w-[85vw] h-full border-l border-border bg-card/95 backdrop-blur-md flex flex-col p-4 shadow-2xl animate-in slide-in-from-right duration-200">
                <SourceList />
              </aside>
            </div>
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
