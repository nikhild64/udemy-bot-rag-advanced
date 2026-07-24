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

import { useUserProfileQuery } from '@/shared/hooks/useUserProfile';
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
  const { data: userProfile } = useUserProfileQuery();
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

        {/* Brand — only show when sidebar is collapsed */}
        {!sidebarOpen && (
          <div
            onClick={handleGoHome}
            className="hidden md:flex items-center gap-2 cursor-pointer hover:opacity-80 transition shrink-0"
            title="Go to Dashboard"
          >
            <div className="w-5 h-5 shrink-0" style={{ transform: "rotate(3.62886deg)" }}>
              <svg viewBox="0 0 2000 2000" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="w-full h-full fill-[#B0B0B0] stroke-[#B0B0B0] dark:fill-[#ffffff] dark:stroke-[#ffffff]">
                <path d="M1507.79 760.427c-.65 63.101-207.62 111.366-468.81 108.688-261.194-2.678-465.548-45.025-464.901-108.125s206.05-123.061 467.241-120.383 467.11 56.719 466.47 119.82Z" fill="#FF7D0C" style={{ transform: "translateY(-4.94929px) scaleX(1.0198)", transformOrigin: "50% 50%", transformBox: "fill-box" }} />
                <path fillRule="evenodd" clipRule="evenodd" d="M577.01 773.174c-.451 3.527 1.81 7.818 6.331 16.401L1117.43 1803.52c2.46 4.68 3.7 7.03 5.55 8.5 1 .79 2.12 1.41 3.32 1.83 28.51 20.3 130.79 12.59 246.39-20.47 117.49-33.59 211.34-88.69 221.94-122.06.43-.72.78-1.49 1.04-2.29.73-2.24.47-4.87-.05-10.11l-88.63-893.466c-.57-5.817-.86-8.725-2.19-10.909a11.23 11.23 0 0 0-4.92-4.392c-2.32-1.066-5.25-1.02-11.09-.929l-889.797 13.95c-9.7.152-14.549.228-17.428 2.316a11.26 11.26 0 0 0-4.555 7.684Z" fill="#FE9332" style={{ transform: "translateY(0.577542px) scaleX(1.00385)", transformOrigin: "50% 50%", transformBox: "fill-box" }} />
                <path fillRule="evenodd" clipRule="evenodd" d="M1550.93 228.057c-1.07-12.387-11.99-21.558-24.37-20.485-12.39 1.073-21.56 11.985-20.49 24.372l125.67 1450.336c.54 2.24.73 4.54.6 6.89l.04.49c-.03-.01-.05-.01-.08-.01-2.95 37.71-92.11 88.78-258.4 137.06-172.87 50.18-276.27 47.2-294.64 17.18-.01.01-.02.01-.03.02l-.33-.62c-.25-.44-.48-.88-.69-1.33L394.815 529.664c-5.743-11.028-19.338-15.312-30.366-9.569s-15.312 19.338-9.569 30.365l693.16 1331.05c1.11 2.13 2.51 4.01 4.13 5.61 17.18 27.88 166.06 29.99 332.52-19.31 152.93-45.29 271.73-97.49 292.19-140.5 1.46-2.59 2.43-5.49 2.77-8.55.44-2.62.47-5.2.08-7.74-.11-.7-.27-1.38-.49-2.05z" />
                <path d="M932.328 283.002C1098 238.611 1247.64 214.748 1357.32 210.36c55.07-2.203 98.56.574 128.49 7.373 15.01 3.408 25.13 7.503 31.32 11.401 2.99 1.885 4.63 3.447 5.46 4.443.4.483.61.822.7 1.006.1.177.12.27.13.305s.03.1.03.245c.01.152 0 .476-.09 1.008-.2 1.101-.79 3.087-2.4 6.026-3.36 6.11-10.03 14.313-21.42 24.327-22.71 19.973-59.27 42.929-108.48 67.363-97.98 48.649-240.34 100.373-406.295 144.842-165.805 44.427-318.862 70.533-431.992 77.105-56.801 3.299-102.026 1.575-133.295-4.525-15.699-3.063-26.285-6.934-32.743-10.704-4.324-2.525-5.68-4.305-6.027-4.893.007-.683.291-2.903 2.773-7.251 3.708-6.494 10.94-15.14 23.004-25.641 24.031-20.918 62.334-45.023 113.175-70.567 101.259-50.874 246.864-104.793 412.668-149.221Z" fill="none" strokeWidth="56.281" />
                <path d="m990.214 1303.45 135.216 9.56c6.4 21.56 9.38 37.25 8.94 47.06l-196.728-19.23-11.429-38.5 151.767-132.19c5.62 7.64 11.68 22.41 18.19 44.31zm338.106-50.68 108.09-81.79-137.35-16.76c-5.18-17.45-7.37-32.99-6.58-46.63l196.96 27.53 11.42 38.5-154.36 123.47c-5.72-7.99-11.78-22.76-18.18-44.32Zm-156.81 189.1 39.34-406.29 42.13-9.28-39.34 406.29z" fill="currentColor" />
              </svg>
            </div>
            <span className="text-[13px] font-onest font-medium tracking-tight text-foreground">
              ChaibookLM
            </span>
          </div>
        )}
        {/* Mobile brand — always show */}
        <div
          onClick={handleGoHome}
          className="flex md:hidden items-center gap-2 cursor-pointer hover:opacity-80 transition shrink-0"
          title="Go to Dashboard"
        >
          <div className="w-5 h-5 shrink-0" style={{ transform: "rotate(3.62886deg)" }}>
            <svg viewBox="0 0 2000 2000" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="w-full h-full fill-[#B0B0B0] stroke-[#B0B0B0] dark:fill-[#ffffff] dark:stroke-[#ffffff]">
              <path d="M1507.79 760.427c-.65 63.101-207.62 111.366-468.81 108.688-261.194-2.678-465.548-45.025-464.901-108.125s206.05-123.061 467.241-120.383 467.11 56.719 466.47 119.82Z" fill="#FF7D0C" style={{ transform: "translateY(-4.94929px) scaleX(1.0198)", transformOrigin: "50% 50%", transformBox: "fill-box" }} />
              <path fillRule="evenodd" clipRule="evenodd" d="M577.01 773.174c-.451 3.527 1.81 7.818 6.331 16.401L1117.43 1803.52c2.46 4.68 3.7 7.03 5.55 8.5 1 .79 2.12 1.41 3.32 1.83 28.51 20.3 130.79 12.59 246.39-20.47 117.49-33.59 211.34-88.69 221.94-122.06.43-.72.78-1.49 1.04-2.29.73-2.24.47-4.87-.05-10.11l-88.63-893.466c-.57-5.817-.86-8.725-2.19-10.909a11.23 11.23 0 0 0-4.92-4.392c-2.32-1.066-5.25-1.02-11.09-.929l-889.797 13.95c-9.7.152-14.549.228-17.428 2.316a11.26 11.26 0 0 0-4.555 7.684Z" fill="#FE9332" style={{ transform: "translateY(0.577542px) scaleX(1.00385)", transformOrigin: "50% 50%", transformBox: "fill-box" }} />
              <path fillRule="evenodd" clipRule="evenodd" d="M1550.93 228.057c-1.07-12.387-11.99-21.558-24.37-20.485-12.39 1.073-21.56 11.985-20.49 24.372l125.67 1450.336c.54 2.24.73 4.54.6 6.89l.04.49c-.03-.01-.05-.01-.08-.01-2.95 37.71-92.11 88.78-258.4 137.06-172.87 50.18-276.27 47.2-294.64 17.18-.01.01-.02.01-.03.02l-.33-.62c-.25-.44-.48-.88-.69-1.33L394.815 529.664c-5.743-11.028-19.338-15.312-30.366-9.569s-15.312 19.338-9.569 30.365l693.16 1331.05c1.11 2.13 2.51 4.01 4.13 5.61 17.18 27.88 166.06 29.99 332.52-19.31 152.93-45.29 271.73-97.49 292.19-140.5 1.46-2.59 2.43-5.49 2.77-8.55.44-2.62.47-5.2.08-7.74-.11-.7-.27-1.38-.49-2.05z" />
              <path d="M932.328 283.002C1098 238.611 1247.64 214.748 1357.32 210.36c55.07-2.203 98.56.574 128.49 7.373 15.01 3.408 25.13 7.503 31.32 11.401 2.99 1.885 4.63 3.447 5.46 4.443.4.483.61.822.7 1.006.1.177.12.27.13.305s.03.1.03.245c.01.152 0 .476-.09 1.008-.2 1.101-.79 3.087-2.4 6.026-3.36 6.11-10.03 14.313-21.42 24.327-22.71 19.973-59.27 42.929-108.48 67.363-97.98 48.649-240.34 100.373-406.295 144.842-165.805 44.427-318.862 70.533-431.992 77.105-56.801 3.299-102.026 1.575-133.295-4.525-15.699-3.063-26.285-6.934-32.743-10.704-4.324-2.525-5.68-4.305-6.027-4.893.007-.683.291-2.903 2.773-7.251 3.708-6.494 10.94-15.14 23.004-25.641 24.031-20.918 62.334-45.023 113.175-70.567 101.259-50.874 246.864-104.793 412.668-149.221Z" fill="none" strokeWidth="56.281" />
              <path d="m990.214 1303.45 135.216 9.56c6.4 21.56 9.38 37.25 8.94 47.06l-196.728-19.23-11.429-38.5 151.767-132.19c5.62 7.64 11.68 22.41 18.19 44.31zm338.106-50.68 108.09-81.79-137.35-16.76c-5.18-17.45-7.37-32.99-6.58-46.63l196.96 27.53 11.42 38.5-154.36 123.47c-5.72-7.99-11.78-22.76-18.18-44.32Zm-156.81 189.1 39.34-406.29 42.13-9.28-39.34 406.29z" fill="currentColor" />
            </svg>
          </div>
          <span className="text-[13px] font-onest font-medium tracking-tight text-foreground">
            ChaibookLM
          </span>
        </div>

        {/* Notebook info — only show when sidebar is collapsed */}
        {!hideNotebookInfo && notebook && !sidebarOpen && (
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2 min-w-0 border-l border-border/50 pl-2 sm:pl-3">
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
        {/* Mobile notebook info — always show */}
        {!hideNotebookInfo && notebook && (
          <div className="flex md:hidden items-center gap-1.5 min-w-0 border-l border-border/50 pl-2">
            <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
            <h1 className="text-xs font-semibold text-foreground truncate max-w-[120px]">{notebook.title}</h1>
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
            <div className="relative flex items-center">
              {userProfile?.isPro ? (
                <>
                  {/* Animated spinning gold ring */}
                  <div className="pro-avatar-ring rounded-full p-[2.5px]">
                    <div className="rounded-full bg-background p-0">
                      <UserButton
                        appearance={{
                          elements: {
                            avatarBox: 'w-7 h-7 rounded-full',
                          },
                        }}
                      />
                    </div>
                  </div>
                  {/* PRO pill badge */}
                  <div
                    className="pro-badge-pill absolute -bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-[2px] px-[5px] py-[1px] rounded-[4px] bg-gradient-to-b from-[#2a2000] to-[#1a1400] border border-amber-500/50 shadow-[0_1px_6px_rgba(255,215,0,0.25),inset_0_1px_0_rgba(255,215,0,0.1)] pointer-events-none select-none"
                    title="PRO Account Active"
                  >
                    <svg className="w-[7px] h-[7px] text-amber-400" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.5 18.5l1.5-9L8.5 13l3.5-8 3.5 8 4.5-3.5 1.5 9h-19z"/>
                    </svg>
                    <span className="text-[7px] font-black tracking-[0.08em] bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent leading-none">PRO</span>
                  </div>
                </>
              ) : (
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: 'w-7 h-7',
                    },
                  }}
                />
              )}
            </div>
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
