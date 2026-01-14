import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { iconSize } from '../../utils';
import { useTheme } from '../../hooks/context/useTheme';
import { Toggle } from './Toggle';
import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip';

const styles = {
  icon: 'transition-transform duration-300',
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
          {isLightTheme && <Sun size={iconSize()} className={styles.icon} />}
          {!isLightTheme && <Moon size={iconSize()} className={styles.icon} />}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>
        Switch to {isLightTheme ? 'dark' : 'light'} mode
      </TooltipContent>
    </Tooltip>
  );
};

export default ThemeToggle;
