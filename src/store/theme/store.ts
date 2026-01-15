import { create } from 'zustand';

const STORAGE_KEY = 'theme';

const getInitialTheme = (): boolean => {
  if (typeof window === 'undefined') return true;

  const savedTheme = localStorage.getItem(STORAGE_KEY);
  if (savedTheme) {
    return savedTheme === 'light';
  }

  if (
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return false;
  }

  return true;
};

const syncThemeToDOM = (isLight: boolean): void => {
  if (typeof document === 'undefined') return;

  const themeString = isLight ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', themeString);
  document.documentElement.className = themeString;
};

type State = {
  isLightTheme: boolean;
};

type Actions = {
  toggleTheme: () => void;
};

export type ThemeStore = State & Actions;

export const useThemeStore = create<ThemeStore>((set, get) => {
  // Sync initial theme to DOM
  const initialIsLight = getInitialTheme();
  syncThemeToDOM(initialIsLight);

  return {
    isLightTheme: initialIsLight,

    toggleTheme: () => {
      const newIsLight = !get().isLightTheme;
      localStorage.setItem(STORAGE_KEY, newIsLight ? 'light' : 'dark');
      syncThemeToDOM(newIsLight);
      set({ isLightTheme: newIsLight });
    },
  };
});

export const getThemeStore = () => useThemeStore.getState();
