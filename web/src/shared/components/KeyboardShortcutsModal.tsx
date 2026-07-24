'use client';

import React from 'react';
import { Command, Search, PlusCircle, Upload, MessageSquare, HelpCircle, X } from 'lucide-react';
import { useTranslation } from '../lib/i18n-context';
import { Button } from '@/components/ui/button';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const shortcutList = [
    { key: 'Cmd/Ctrl + K', description: t('shortcuts.search', 'Global Search'), icon: Search },
    { key: 'Cmd/Ctrl + N', description: t('shortcuts.new_notebook', 'Create Notebook'), icon: PlusCircle },
    { key: 'Cmd/Ctrl + U', description: t('shortcuts.upload_source', 'Upload Source'), icon: Upload },
    { key: 'Cmd/Ctrl + /', description: t('shortcuts.focus_chat', 'Focus Chat Input'), icon: MessageSquare },
    { key: '?', description: t('shortcuts.help', 'Show Shortcuts'), icon: HelpCircle },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-label="Keyboard Shortcuts"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center space-x-2">
            <Command className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">{t('shortcuts.title', 'Keyboard Shortcuts')}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {shortcutList.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg bg-background p-3 border border-border hover:border-primary/40 transition"
              >
                <div className="flex items-center space-x-3 text-foreground">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.description}</span>
                </div>
                <kbd className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-mono font-semibold text-primary shadow-xs">
                  {item.key}
                </kbd>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold shadow-xs"
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
