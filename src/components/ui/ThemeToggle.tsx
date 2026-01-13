import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/context/useTheme';
import { Toggle } from './Toggle';
import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip';

const styles = {
  icon: 'h-4 w-4 transition-transform duration-300',
} as const;

/**
 * Theme toggle component for switching between light and dark modes.
 *
 * Uses Radix Toggle for proper pressed state handling and Tooltip for accessibility.
 *
 * @example
 * <ThemeToggle />
 */
export const ThemeToggle: React.FC = () => {
  const { isLightTheme, toggleTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          pressed={!isLightTheme}
          onPressedChange={toggleTheme}
          aria-label={`Switch to ${isLightTheme ? 'dark' : 'light'} mode`}
        >
          {isLightTheme && <Sun className={styles.icon} />}
          {!isLightTheme && <Moon className={styles.icon} />}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>
        Switch to {isLightTheme ? 'dark' : 'light'} mode
      </TooltipContent>
    </Tooltip>
  );
};

export default ThemeToggle;
