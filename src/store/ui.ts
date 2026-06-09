import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warn' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface UIState {
  sidebarCollapsed: boolean;
  toasts: ToastItem[];
  loadingStack: number;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  pushToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  pushLoading: () => void;
  popLoading: () => void;
  get isLoading(): boolean;
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarCollapsed: false,
  toasts: [],
  loadingStack: 0,

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

  pushToast: (message, type = 'info') => {
    const id = genId();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  pushLoading: () => set((s) => ({ loadingStack: s.loadingStack + 1 })),
  popLoading: () => set((s) => ({ loadingStack: Math.max(0, s.loadingStack - 1) })),

  get isLoading() {
    return get().loadingStack > 0;
  },
}));
