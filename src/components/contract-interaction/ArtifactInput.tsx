import React, { useCallback, useState } from 'react';
import { cn } from '../../utils';
import { FileUpload, Textarea } from '../ui';
import type { LoadedFile } from '../ui';

const styles = {
  container: 'flex flex-col gap-2',
  label: 'text-sm font-semibold text-default',
  inputWrapper: 'flex flex-col gap-3',
  // Divider styles
  divider: 'flex items-center gap-3',
  dividerLine: 'flex-1 h-px bg-default/50',
  dividerText: 'text-xs font-medium text-muted',
  // Error/helper styles
  error: 'text-sm text-error',
  helperText: 'text-sm text-muted',
  // Textarea for paste mode
  pasteTextarea: 'min-h-[160px]',
} as const;

interface ArtifactInputProps {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  rows?: number;
  /** Pre-loaded file to display in read-only mode (for preconfigured contracts) */
  preloadedFile?: LoadedFile;
  /** Input method to show: 'file' for upload only, 'paste' for textarea only, null/undefined for both */
  inputMethod?: 'file' | 'paste' | null;
}

export const ArtifactInput: React.FC<ArtifactInputProps> = ({
  id,
  label = 'Contract Artifact (JSON)',
  value,
  onChange,
  placeholder = 'Paste contract artifact JSON here...',
  disabled = false,
  error,
  helperText,
  rows = 6,
  preloadedFile,
  inputMethod,
}) => {
  const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null);
  const isCleared = value === '';
  const displayedFile = isCleared ? null : loadedFile;
  const fileKey = isCleared ? 'cleared' : 'loaded';

  const handleFileChange = useCallback(
    (file: LoadedFile | null) => {
      setLoadedFile(file);
      onChange(file?.content ?? '');
    },
    [onChange]
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // If user starts typing in textarea, clear file state
      if (loadedFile) {
        setLoadedFile(null);
      }
      onChange(e.target.value);
    },
    [loadedFile, onChange]
  );

  // If preloaded file is provided, show in read-only mode
  if (preloadedFile) {
    return (
      <div className={styles.container}>
        {label && (
          <label htmlFor={id} className={styles.label}>
            {label}
          </label>
        )}
        <FileUpload
          id={`${id}-file`}
          file={preloadedFile}
          onFileChange={() => {}}
          readOnly
        />
        {error && <p className={cn(styles.error)}>{error}</p>}
        {helperText && !error && (
          <p className={styles.helperText}>{helperText}</p>
        )}
      </div>
    );
  }

  // If inputMethod is specified, show only that input type
  if (inputMethod === 'file') {
    return (
      <div className={styles.container}>
        {label && (
          <label htmlFor={id} className={styles.label}>
            {label}
          </label>
        )}
        <FileUpload
          id={`${id}-file`}
          key={fileKey}
          file={displayedFile}
          onFileChange={handleFileChange}
          accept={['.json']}
          dropText="Drop JSON file here or click to browse"
          dropHint="Supports .json artifact files"
          disabled={disabled}
          height={160}
        />
        {error && <p className={cn(styles.error)}>{error}</p>}
        {helperText && !error && (
          <p className={styles.helperText}>{helperText}</p>
        )}
      </div>
    );
  }

  if (inputMethod === 'paste') {
    return (
      <div className={styles.container}>
        {label && (
          <label htmlFor={id} className={styles.label}>
            {label}
          </label>
        )}
        <Textarea
          id={id}
          value={value}
          onChange={handleTextareaChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={styles.pasteTextarea}
        />
        {error && <p className={cn(styles.error)}>{error}</p>}
        {helperText && !error && (
          <p className={styles.helperText}>{helperText}</p>
        )}
      </div>
    );
  }

  // Default: show both with divider (legacy behavior)
  return (
    <div className={styles.container}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}

      <div className={styles.inputWrapper}>
        <FileUpload
          id={`${id}-file`}
          key={fileKey}
          file={displayedFile}
          onFileChange={handleFileChange}
          accept={['.json']}
          dropText="Drop JSON file here or click to browse"
          dropHint="Supports .json artifact files"
          disabled={disabled}
        />

        {/* Divider and textarea - only show when no file is loaded */}
        {!displayedFile && (
          <>
            <div className={styles.divider}>
              <div className={styles.dividerLine} />
              <span className={styles.dividerText}>or paste manually</span>
              <div className={styles.dividerLine} />
            </div>

            <Textarea
              id={id}
              value={value}
              onChange={handleTextareaChange}
              placeholder={placeholder}
              disabled={disabled}
              rows={rows}
            />
          </>
        )}
      </div>

      {error && <p className={cn(styles.error)}>{error}</p>}
      {helperText && !error && (
        <p className={styles.helperText}>{helperText}</p>
      )}
    </div>
  );
};
