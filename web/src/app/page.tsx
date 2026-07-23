'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/shared/components/layout/AppLayout';
import { ChatContainer } from '@/features/chat/components/ChatContainer';
import { DashboardView } from '@/features/dashboard/components/DashboardView';
import { LandingPage } from '@/features/landing/components/LandingPage';
import { GlobalSearchModal } from '@/shared/components/GlobalSearchModal';
import { KeyboardShortcutsModal } from '@/shared/components/KeyboardShortcutsModal';
import { SettingsModal } from '@/features/settings/components/SettingsModal';
import { I18nProvider } from '@/shared/lib/i18n-context';
import { useUIStore } from '@/shared/lib/store';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import { useAuth } from '@clerk/nextjs';

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const setCreateNotebookModalOpen = useUIStore((s) => s.setCreateNotebookModalOpen);
  const setUploadModalOpen = useUIStore((s) => s.setUploadModalOpen);

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  useKeyboardShortcuts({
    onSearch: () => setSearchModalOpen(true),
    onCreateNotebook: () => setCreateNotebookModalOpen(true),
    onUploadSource: () => {
      if (activeNotebookId) setUploadModalOpen(true);
    },
    onFocusChat: () => {
      const textarea = document.querySelector('textarea');
      if (textarea) textarea.focus();
    },
    onToggleShortcutsHelp: () => setShortcutsModalOpen((prev) => !prev),
  });

  if (isLoaded && !isSignedIn) {
    return <LandingPage />;
  }

  return (
    <I18nProvider>
      <AppLayout>
        {activeNotebookId ? (
          <ChatContainer />
        ) : (
          <DashboardView
            onOpenSearch={() => setSearchModalOpen(true)}
            onOpenSettings={() => setSettingsModalOpen(true)}
            onCreateNotebook={() => setCreateNotebookModalOpen(true)}
          />
        )}

        <GlobalSearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
        <KeyboardShortcutsModal isOpen={shortcutsModalOpen} onClose={() => setShortcutsModalOpen(false)} />
        <SettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
      </AppLayout>
    </I18nProvider>
  );
}
