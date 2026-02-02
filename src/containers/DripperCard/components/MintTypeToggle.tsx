import React from 'react';
import { Shield, Globe } from 'lucide-react';
import { cn, iconSize } from '../../../utils';
import { styles } from '../styles';

interface MintTypeToggleProps {
  value: 'private' | 'public';
  onChange: (value: 'private' | 'public') => void;
  disabled?: boolean;
}

export const MintTypeToggle: React.FC<MintTypeToggleProps> = ({
  value,
  onChange,
  disabled,
}) => (
  <div className={styles.typeToggle}>
    <button
      type="button"
      className={cn(
        styles.toggleButton.base,
        value === 'private'
          ? styles.toggleButton.active
          : styles.toggleButton.inactive
      )}
      onClick={() => onChange('private')}
      disabled={disabled}
      aria-pressed={value === 'private'}
    >
      <Shield size={iconSize('xs')} />
      <span>Private</span>
    </button>
    <button
      type="button"
      className={cn(
        styles.toggleButton.base,
        value === 'public'
          ? styles.toggleButton.active
          : styles.toggleButton.inactive
      )}
      onClick={() => onChange('public')}
      disabled={disabled}
      aria-pressed={value === 'public'}
    >
      <Globe size={iconSize('xs')} />
      <span>Public</span>
    </button>
  </div>
);
