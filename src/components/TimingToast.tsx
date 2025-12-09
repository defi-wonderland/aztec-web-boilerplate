import React, { useEffect, useState } from 'react';

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
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    const timer = window.setTimeout(() => setIsVisible(false), 8000);
    return () => window.clearTimeout(timer);
  }, [elapsedMs, contractCount, fromCache]);

  if (!isVisible) {
    return null;
  }

  const labelSuffix = contractCount === 1 ? '' : 's';
  const sourceText = fromCache ? 'Cached in PXE' : 'Fresh registration';
  const icon = fromCache ? '⚡' : '🆕';

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex max-w-md items-start gap-3 rounded-lg border border-[color:var(--color-border,#334155)] bg-[color:var(--color-surface,#0f172a)] px-4 py-3 text-[color:var(--color-text,#e2e8f0)] shadow-lg"
      role="status"
      aria-live="polite"
    >
      <span className="text-xl leading-none">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold">
          Contracts loaded in {elapsedMs.toFixed(0)}ms
        </p>
        <p className="text-xs opacity-80">
          {contractCount} contract{labelSuffix} • {sourceText}
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss timing toast"
        onClick={() => {
          setIsVisible(false);
          onClose();
        }}
        className="ml-2 text-lg leading-none opacity-70 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-border,#334155)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface,#0f172a)]"
      >
        ✕
      </button>
    </div>
  );
};
