import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileText, X, Copy, Download, Check } from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { cn, downloadAsFile, iconSize } from '../../utils';

const styles = {
  container: 'flex flex-col gap-2',
  label: 'text-sm font-semibold text-default',
  // Drop zone styles
  dropZone: cn(
    'flex flex-col items-center justify-center gap-2',
    'w-full rounded-xl',
    'border border-dashed border-zinc-300',
    'bg-surface cursor-pointer',
    'transition-all duration-200'
  ),
  dropZoneHover: 'border-accent bg-accent/5',
  dropZoneDisabled: 'opacity-50 cursor-not-allowed',
  dropIcon: 'text-muted',
  dropText: 'text-sm font-medium text-muted',
  dropHint: 'text-xs text-muted/70',
  // File loaded state
  fileLoaded: cn(
    'flex items-center justify-between',
    'w-full px-4 py-3 rounded-xl',
    'bg-accent/10 border border-accent'
  ),
  fileInfo: 'flex items-center gap-3',
  fileIcon: 'text-accent',
  fileDetails: 'flex flex-col gap-0.5',
  fileName: 'text-sm font-semibold text-default',
  fileSize: 'text-xs text-muted',
  actionsRow: 'flex items-center gap-2',
  actionBtn: cn(
    'flex items-center justify-center w-8 h-8 rounded-md',
    'bg-surface text-muted',
    'hover:bg-surface-secondary hover:text-default transition-colors',
    'cursor-pointer'
  ),
  actionBtnSuccess: 'text-success',
  removeBtn: cn(
    'flex items-center gap-1.5 px-3 py-1.5 rounded-md',
    'bg-surface text-muted text-xs font-medium',
    'hover:bg-surface-secondary transition-colors',
    'cursor-pointer'
  ),
  // Hidden input
  hiddenInput: 'hidden',
  // Error/helper styles
  error: 'text-sm text-error',
  helperText: 'text-sm text-muted',
} as const;

export interface LoadedFile {
  name: string;
  size: number;
  content: string;
}

export interface FileUploadProps {
  /** Unique identifier for the input */
  id: string;
  /** Label text displayed above the drop zone */
  label?: string;
  /** Currently loaded file (controlled) */
  file: LoadedFile | null;
  /** Callback when file is loaded or removed */
  onFileChange: (file: LoadedFile | null) => void;
  /** Accepted file extensions (e.g., ['.json', '.txt']) */
  accept?: string[];
  /** Text shown in the drop zone */
  dropText?: string;
  /** Hint text shown below the drop text */
  dropHint?: string;
  /** Height of the drop zone */
  height?: number;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Error message to display */
  error?: string;
  /** Helper text to display */
  helperText?: string;
  /** Maximum file size in bytes (default: 30MB) */
  maxSize?: number;
  /** Custom class name for the container */
  className?: string;
  /** Read-only mode: shows copy/download actions instead of remove */
  readOnly?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FileUpload: React.FC<FileUploadProps> = ({
  id,
  label,
  file,
  onFileChange,
  accept = [],
  dropText = 'Drop file here or click to browse',
  dropHint,
  height = 100,
  disabled = false,
  error,
  helperText,
  className,
  maxSize = 30 * 1024 * 1024, // 30MB default
  readOnly = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptString = accept.join(',');

  const isValidFile = useCallback(
    (fileName: string): boolean => {
      if (accept.length === 0) return true;
      return accept.some((ext) => fileName.toLowerCase().endsWith(ext));
    },
    [accept]
  );

  const handleFileRead = useCallback(
    (inputFile: File) => {
      if (!isValidFile(inputFile.name)) {
        setValidationError(`Invalid file type. Accepted: ${accept.join(', ')}`);
        return;
      }
      if (maxSize && inputFile.size > maxSize) {
        setValidationError(
          `File too large (${formatFileSize(inputFile.size)}). Maximum: ${formatFileSize(maxSize)}`
        );
        return;
      }

      setValidationError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileChange({
          name: inputFile.name,
          size: inputFile.size,
          content,
        });
      };
      reader.onerror = () => {
        const message =
          reader.error?.message ||
          'An unknown error occurred while reading the file';
        console.error('FileReader error:', reader.error);
        setValidationError(`Failed to read file: ${message}`);
      };
      reader.readAsText(inputFile);
    },
    [isValidFile, maxSize, onFileChange, accept]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileRead(droppedFile);
      }
    },
    [disabled, handleFileRead]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileRead(selectedFile);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [handleFileRead]
  );

  const handleRemoveFile = useCallback(() => {
    setValidationError(null);
    onFileChange(null);
  }, [onFileChange]);

  const handleCopy = useCallback(() => {
    if (!file?.content) return;
    copy(file.content);
  }, [file, copy]);

  const handleDownload = useCallback(() => {
    if (!file) return;
    downloadAsFile(file.content, file.name);
  }, [file]);

  return (
    <div className={cn(styles.container, className)}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}

      {/* Hidden file input */}
      <input
        id={id}
        ref={fileInputRef}
        type="file"
        accept={acceptString}
        onChange={handleFileInputChange}
        className={styles.hiddenInput}
        disabled={disabled}
      />

      {file ? (
        /* File loaded state */
        <div className={styles.fileLoaded}>
          <div className={styles.fileInfo}>
            <FileText size={iconSize('md')} className={styles.fileIcon} />
            <div className={styles.fileDetails}>
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>
                {formatFileSize(file.size)}
              </span>
            </div>
          </div>
          {readOnly && (
            <div className={styles.actionsRow}>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  styles.actionBtn,
                  copied && styles.actionBtnSuccess
                )}
                title={(copied && 'Copied!') || 'Copy to clipboard'}
              >
                {copied && <Check size={iconSize()} />}
                {!copied && <Copy size={iconSize()} />}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className={styles.actionBtn}
                title="Download file"
              >
                <Download size={iconSize()} />
              </button>
            </div>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={handleRemoveFile}
              className={styles.removeBtn}
              disabled={disabled}
            >
              <X size={iconSize('xs')} />
              Remove
            </button>
          )}
        </div>
      ) : (
        /* Drop zone */
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          className={cn(
            styles.dropZone,
            isDragOver && styles.dropZoneHover,
            disabled && styles.dropZoneDisabled
          )}
          style={{ height }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleClick();
            }
          }}
        >
          <Upload size={iconSize('lg')} className={styles.dropIcon} />
          <span className={styles.dropText}>{dropText}</span>
          {dropHint && <span className={styles.dropHint}>{dropHint}</span>}
        </div>
      )}

      {(error || validationError) && (
        <p className={styles.error}>{error || validationError}</p>
      )}
      {helperText && !error && !validationError && (
        <p className={styles.helperText}>{helperText}</p>
      )}
    </div>
  );
};
