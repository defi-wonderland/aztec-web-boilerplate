export const styles = {
  // Card
  card: 'overflow-hidden',

  // Token Header
  tokenHeader: 'flex items-center justify-between p-6 border-b border-default',
  tokenLeft: 'flex items-center gap-3.5 min-w-0 flex-1',
  tokenIcon:
    'flex items-center justify-center w-12 h-12 rounded-xl bg-accent shrink-0',
  tokenIconInner: 'text-on-accent',
  tokenInfo: 'flex flex-col gap-0.5 min-w-0',
  tokenName: 'text-lg font-semibold text-default',
  tokenAddress:
    'flex items-center gap-1.5 text-sm text-muted font-mono cursor-pointer hover:text-default transition-colors',
  tokenAddressText: 'break-all',
  copyIcon: 'text-muted shrink-0',

  // Balance Section
  balanceSection: 'p-6 space-y-5',
  totalRow: 'flex items-end justify-between',
  totalLeft: 'flex flex-col gap-1',
  totalLabelRow: 'flex items-center gap-1.5 flex-wrap',
  totalLabel: 'text-sm text-muted font-medium',
  totalInfoIcon: 'text-muted cursor-help',
  totalValue:
    'text-5xl font-bold text-default font-mono tracking-tight cursor-help',
  totalUnit: 'text-base text-muted font-medium pb-2',
  breakdownRow: 'flex flex-col sm:flex-row gap-3',
  balanceBox:
    'flex-1 flex items-center justify-between p-3.5 rounded-xl bg-surface',
  balanceBoxLeft: 'flex items-center gap-2.5',
  balanceBoxIcon: {
    private: 'text-accent',
    public: 'text-teal-500',
  },
  balanceBoxLabel: 'text-sm font-medium text-muted',
  balanceBoxValue: 'font-semibold text-default font-mono cursor-help',
  balanceBoxPercent: {
    private:
      'text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    public:
      'text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  },
  balanceBoxRight: 'flex items-center gap-2',
  progressBar:
    'h-1.5 rounded-full bg-teal-100 dark:bg-teal-900/30 overflow-hidden',
  progressFill: 'h-full bg-accent transition-all duration-500',
  syncBadge: 'animate-pulse',

  // Divider
  divider: 'h-px bg-surface-secondary',

  // Mint Section
  mintSection: 'p-6 space-y-5',
  mintHeader: 'flex items-center justify-between',
  mintTitle: 'text-base font-semibold text-default',
  mintDescription: 'text-sm text-muted',
  mintForm: 'space-y-4',
  inputsRow: 'flex flex-col sm:flex-row gap-3',
  inputField: 'flex-1 space-y-1.5',
  inputLabel: 'text-sm font-medium text-muted',
  amountInputWrapper:
    'flex items-center justify-between h-12 px-4 rounded-xl bg-surface border border-default',
  amountInput:
    'flex-1 bg-transparent border-0 outline-none text-default font-normal h-auto p-0 rounded-none shadow-none focus:ring-0 focus:border-transparent',
  amountUnit: 'text-sm text-muted font-medium',
  typeToggle: 'flex h-12 p-1 rounded-xl bg-surface border border-default',
  toggleButton: {
    base: 'flex-1 flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer',
    active: 'bg-accent text-on-accent font-semibold',
    inactive: 'text-muted hover:text-default',
  },
  mintButton: 'w-full',

  // Loading state
  loadingContainer:
    'flex flex-col items-center justify-center py-12 gap-4 text-muted',
  loadingSpinner:
    'animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent',
  loadingText: 'text-sm',

  // Balance loading state
  balanceLoadingContainer:
    'flex items-center justify-center gap-3 py-8 text-muted',
  balanceLoadingSpinner:
    'animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent',

  // Error state
  errorContainer: 'text-center py-6',
  errorIcon: 'text-amber-500 mx-auto mb-2',
  errorTitle: 'text-lg font-semibold text-default mb-1',
  errorText: 'text-sm text-muted',

  // Skeleton placeholders
  skeleton: {
    tokenName: 'h-5 w-36 rounded-md',
    tokenAddress: 'h-4 w-48 rounded-md',
    totalValue: 'h-12 w-32 rounded-md',
    totalUnit: 'h-5 w-10 rounded-md',
    balanceValue: 'h-5 w-16 rounded-md',
    progressBar: 'h-1.5 w-full rounded-full',
  },
} as const;
