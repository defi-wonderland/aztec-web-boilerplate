import React from 'react';
import { useTheme } from '../hooks/context/useTheme';

export const ThemeToggle: React.FC = () => {
  const { isLightTheme, toggleTheme } = useTheme();

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
