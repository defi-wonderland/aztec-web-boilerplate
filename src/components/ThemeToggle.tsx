import React from 'react';
import { useTheme } from '../providers';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <span className="theme-icon dark-mode" role="img" aria-label="Dark Mode">
          ◆
        </span>
      ) : (
        <span className="theme-icon light-mode" role="img" aria-label="Light Mode">
          ◇
        </span>
      )}
    </button>
  );
};
