import React from 'react';
import { useIsLightTheme, useToggleTheme } from '../store/theme';

export const ThemeToggle: React.FC = () => {
  const isLightTheme = useIsLightTheme();
  const toggleTheme = useToggleTheme();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      title={`Switch to ${isLightTheme ? 'dark' : 'light'} mode`}
      type="button"
    >
      {isLightTheme ? '◆' : '◇'}
    </button>
  );
};
