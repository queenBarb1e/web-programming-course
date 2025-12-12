import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '../types/quiz';

interface UIStore {
  theme: Theme;
  soundEnabled: boolean;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void; 
  toggleSound: () => void; 
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      theme: 'light',
      soundEnabled: true,
      setTheme: (theme: Theme) => set({ theme }),

      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),
      toggleSound: () =>
        set((state) => ({ soundEnabled: !state.soundEnabled })),
    }),
    {
      name: 'ui-storage',
    }
  )
);
