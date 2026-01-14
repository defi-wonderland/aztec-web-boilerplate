import React from 'react';
import { Loader2 } from 'lucide-react';
import { iconSize } from '../../../utils';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../ui';
import type { PreconfiguredSelectorProps } from '../types';

const styles = {
  section: 'flex flex-col gap-2',
  label: 'text-sm font-semibold text-default',
  hint: 'text-sm text-muted',
  hintSuccess: 'text-sm text-green-600',
  hintLoading: 'flex items-center gap-2 text-sm text-muted',
} as const;

const PreconfiguredSelector: React.FC<PreconfiguredSelectorProps> = ({
  preconfigured,
  selectedId,
  onSelect,
  isLoading = false,
  disabled = false,
}) => {
  const isCustomMode = !selectedId;
  const isPreconfiguredMode = Boolean(selectedId);

  const handleSelectChange = (value: string) => {
    onSelect(value === 'custom' ? null : value || null);
  };

  return (
    <div className={styles.section}>
      <label htmlFor="preconfigured-contract" className={styles.label}>
        Contract Source
      </label>
      <Select
        value={selectedId ?? 'custom'}
        onValueChange={handleSelectChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger id="preconfigured-contract">
          <SelectValue placeholder="Custom (enter manually)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="custom">Custom (enter manually)</SelectItem>
          {preconfigured.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isCustomMode && (
        <p className={styles.hint}>
          Enter your own contract address and artifact below.
        </p>
      )}
      {isPreconfiguredMode && !isLoading && (
        <p className={styles.hintSuccess}>
          Artifact is pre-filled. Address can be changed if needed.
        </p>
      )}
      {isLoading && (
        <p className={styles.hintLoading}>
          <Loader2 size={iconSize()} className="animate-spin" />
          Loading contract data...
        </p>
      )}
    </div>
  );
};

export default PreconfiguredSelector;
