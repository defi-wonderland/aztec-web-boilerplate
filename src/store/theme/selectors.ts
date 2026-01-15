import { useThemeStore } from './store';

export const useIsLightTheme = () =>
  useThemeStore((state) => state.isLightTheme);

export const useToggleTheme = () => useThemeStore((state) => state.toggleTheme);
