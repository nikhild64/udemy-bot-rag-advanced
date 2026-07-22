'use client';

import { useEffect } from 'react';

export interface ShortcutHandlers {
  onSearch?: () => void;
  onCreateNotebook?: () => void;
  onUploadSource?: () => void;
  onFocusChat?: () => void;
  onToggleShortcutsHelp?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handlers.onSearch?.();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handlers.onCreateNotebook?.();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        handlers.onUploadSource?.();
      } else if (isCmdOrCtrl && e.key === '/') {
        e.preventDefault();
        handlers.onFocusChat?.();
      } else if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        handlers.onToggleShortcutsHelp?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
