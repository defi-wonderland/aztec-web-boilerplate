import React from 'react';
import { Upload, ClipboardPaste } from 'lucide-react';
import { cn, iconSize } from '../../../../../utils';
import type { ArtifactInputMethod } from './setup-utils';

const styles = {
  label: 'text-xs font-medium text-muted',
  grid: 'flex gap-3',
  card: cn(
    'flex-1 flex flex-col items-center gap-2',
    'px-4 py-5 rounded-xl border border-dashed',
    'cursor-pointer transition-all duration-150'
  ),
  cardDefault: cn(
    'border-zinc-300 bg-surface-tertiary/30',
    'hover:border-accent hover:bg-accent/5'
  ),
  icon: 'text-muted',
  title: 'text-sm font-semibold text-default',
  desc: 'text-xs text-muted text-center',
} as const;

interface ArtifactMethodSelectorProps {
  onSelect: (method: NonNullable<ArtifactInputMethod>) => void;
}

export const ArtifactMethodSelector: React.FC<ArtifactMethodSelectorProps> = ({
  onSelect,
}) => {
  return (
    <>
      <span className={styles.label}>
        How would you like to provide the artifact?
      </span>
      <div className={styles.grid}>
        <button
          type="button"
          className={cn(styles.card, styles.cardDefault)}
          onClick={() => onSelect('file')}
        >
          <Upload size={iconSize('lg')} className={styles.icon} />
          <span className={styles.title}>Upload File</span>
          <span className={styles.desc}>Drop or browse for JSON</span>
        </button>
        <button
          type="button"
          className={cn(styles.card, styles.cardDefault)}
          onClick={() => onSelect('paste')}
        >
          <ClipboardPaste size={iconSize('lg')} className={styles.icon} />
          <span className={styles.title}>Paste JSON</span>
          <span className={styles.desc}>Enter artifact manually</span>
        </button>
      </div>
    </>
  );
};
