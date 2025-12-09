import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface TimingToastProps {
  elapsedMs: number;
  contractCount: number;
  fromCache: boolean;
  onClose: () => void;
}

export const TimingToast: React.FC<TimingToastProps> = ({
  elapsedMs,
  contractCount,
  fromCache,
  onClose,
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  console.log('[TimingToast] RENDERING JSX', { elapsedMs, contractCount, fromCache });

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    console.log('[TimingToast] Effect mounted, starting 8s timer');
    const timer = window.setTimeout(() => {
      console.log('[TimingToast] Timer fired, calling onClose');
      onCloseRef.current();
    }, 8000);
    return () => {
      console.log('[TimingToast] Effect cleanup');
      window.clearTimeout(timer);
    };
  }, []);

  const labelSuffix = contractCount === 1 ? '' : 's';
  const sourceText = fromCache ? 'Cached in PXE' : 'Fresh registration';
  const icon = fromCache ? '⚡' : '🆕';

  const toast = (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        zIndex: 9999,
        backgroundColor: '#0f172a',
        color: '#e2e8f0',
        padding: '1rem',
        borderRadius: '0.5rem',
        border: '3px solid red',
        display: 'flex',
        gap: '0.75rem',
        maxWidth: '24rem',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
      }}
    >
      <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
          Contracts loaded in {elapsedMs.toFixed(0)}ms
        </p>
        <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: 0 }}>
          {contractCount} contract{labelSuffix} • {sourceText}
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss timing toast"
        onClick={onClose}
        style={{
          marginLeft: '0.5rem',
          fontSize: '1.125rem',
          lineHeight: 1,
          opacity: 0.7,
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  );

  return createPortal(toast, document.body);
};
