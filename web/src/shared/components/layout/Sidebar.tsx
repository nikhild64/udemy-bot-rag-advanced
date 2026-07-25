"use client"

import { useUIStore } from '@/shared/lib/store';
import { NotebookList } from '@/features/notebooks/components/NotebookList';
import { Sparkles, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

import { Logo } from '@/shared/components/Logo';

interface SidebarProps {
  isMobile?: boolean;
}

export function Sidebar({ isMobile = false }: SidebarProps) {
  const router = useRouter();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const setActiveNotebookId = useUIStore((s) => s.setActiveNotebookId);

  if (!isMobile && !sidebarOpen) return null;

  const handleClose = () => {
    if (isMobile) {
      setMobileSidebarOpen(false);
    } else {
      toggleSidebar();
    }
  };

  const handleGoHome = () => {
    setActiveNotebookId(null);
    if (isMobile) setMobileSidebarOpen(false);
    router.push('/');
  };

  return (
    <aside className={cn(
      "w-full flex flex-col h-full shrink-0 transition-all duration-300",
      !isMobile && "w-56 border-r border-[#1e1e1e] bg-[#0d0d0d]"
    )}>
      {/* Brand Header */}
      <div className="h-12 px-3 border-b border-[#1e1e1e] flex items-center justify-between">
        <div
          onClick={handleGoHome}
          className="cursor-pointer hover:opacity-80 transition"
          title="Go to Dashboard"
        >
          <Logo size="md" />
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-[#505050] hover:text-[#888]"
          onClick={handleClose}
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Notebook List */}
      <div className="flex-1 overflow-hidden px-2 py-2.5">
        <NotebookList isMobile={isMobile} />
      </div>
    </aside>
  );
}
