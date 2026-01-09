import React, { ReactNode, useState, useEffect } from 'react';
import { ThemeContext } from '../hooks/context/useTheme';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isLightTheme, setIsLightTheme] = useState<boolean>(() => {
    // Check localStorage first, then system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'light';
    }

    // Check system preference
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return false; // dark mode
    }

    return true; // light mode default
  });

  const toggleTheme = () => {
    const newIsLightTheme = !isLightTheme;
    setIsLightTheme(newIsLightTheme);
    localStorage.setItem('theme', newIsLightTheme ? 'light' : 'dark');
  };

  useEffect(() => {
    const themeString = isLightTheme ? 'light' : 'dark';

    // Apply theme to document root
    document.documentElement.setAttribute('data-theme', themeString);

    // Also add class for easier CSS targeting
    document.documentElement.className = themeString;
  }, [isLightTheme]);

  const value = {
    isLightTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
