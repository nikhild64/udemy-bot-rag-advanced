import { create } from 'zustand';

interface UIState {
  activeNotebookId: string | null;
  setActiveNotebookId: (id: string | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  sourcesPanelOpen: boolean;
  setSourcesPanelOpen: (open: boolean) => void;
  toggleSourcesPanel: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  mobileSourcesPanelOpen: boolean;
  setMobileSourcesPanelOpen: (open: boolean) => void;
  toggleMobileSourcesPanel: () => void;
  createNotebookModalOpen: boolean;
  setCreateNotebookModalOpen: (open: boolean) => void;
  uploadModalOpen: boolean;
  setUploadModalOpen: (open: boolean) => void;
  settingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
  editingNotebook: { id: string; title: string; description?: string | null } | null;
  setEditingNotebook: (notebook: { id: string; title: string; description?: string | null } | null) => void;
  deletingNotebook: { id: string; title: string } | null;
  setDeletingNotebook: (notebook: { id: string; title: string } | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeNotebookId: null,
  setActiveNotebookId: (id) => set({ activeNotebookId: id }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  sourcesPanelOpen: true,
  setSourcesPanelOpen: (open) => set({ sourcesPanelOpen: open }),
  toggleSourcesPanel: () => set((state) => ({ sourcesPanelOpen: !state.sourcesPanelOpen })),
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  mobileSourcesPanelOpen: false,
  setMobileSourcesPanelOpen: (open) => set({ mobileSourcesPanelOpen: open }),
  toggleMobileSourcesPanel: () => set((state) => ({ mobileSourcesPanelOpen: !state.mobileSourcesPanelOpen })),
  createNotebookModalOpen: false,
  setCreateNotebookModalOpen: (open) => set({ createNotebookModalOpen: open }),
  uploadModalOpen: false,
  setUploadModalOpen: (open) => set({ uploadModalOpen: open }),
  settingsModalOpen: false,
  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),
  editingNotebook: null,
  setEditingNotebook: (notebook) => set({ editingNotebook: notebook }),
  deletingNotebook: null,
  setDeletingNotebook: (notebook) => set({ deletingNotebook: notebook }),
}));
