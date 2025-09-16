import React from 'react';
import { useTheme } from '../hooks/context/useTheme';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      type="button"
    >
      {theme === 'light' ? (
        // Moon icon for dark mode
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.752-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // Sun icon for light mode
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="m12 2 0 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="m12 20 0 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="m4.93 4.93 1.41 1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="m17.66 17.66 1.41 1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="m2 12 2 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="m20 12 2 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="m6.34 17.66-1.41 1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="m19.07 4.93-1.41 1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
};
