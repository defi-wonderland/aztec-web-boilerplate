/**
 * =============================================================================
 * POPUP SHARED STYLES
 * =============================================================================
 *
 * Reusable style tokens for the passkey popup window components.
 * Follows the project's mandatory "styles object" pattern:
 *   - All Tailwind classes defined as const objects BEFORE components
 *   - Uses custom theme utilities from popup.css (bg-surface, text-accent, etc.)
 *   - Never inline className strings in JSX
 */

/* ---------------------------------------------------------------------------
   LAYOUT
   --------------------------------------------------------------------------- */

export const layoutStyles = {
  /** Outer shell — fills the popup window */
  shell: 'min-h-screen bg-page flex items-center justify-center p-4',
  /** Content card — centered, constrained width */
  card: [
    'w-full max-w-sm',
    'bg-surface border border-default rounded-2xl',
    'shadow-theme-lg',
    'p-6',
    'animate-fade-slide-up',
  ].join(' '),
  /** Section with vertical rhythm */
  section: 'flex flex-col gap-3',
} as const;

/* ---------------------------------------------------------------------------
   HEADER / BRANDING
   --------------------------------------------------------------------------- */

export const headerStyles = {
  /** Top row: icon + wordmark */
  row: 'flex items-center gap-2 mb-6',
  /** Aztec "A" icon container */
  logoWrap: [
    'w-8 h-8 rounded-lg',
    'gradient-primary',
    'flex items-center justify-center',
    'shadow-theme',
  ].join(' '),
  logoText: 'text-on-accent font-bold text-sm',
  /** Wordmark */
  wordmark: 'text-base font-semibold text-default',
} as const;

/* ---------------------------------------------------------------------------
   ILLUSTRATION AREA (biometric icon etc.)
   --------------------------------------------------------------------------- */

export const illustrationStyles = {
  wrap: 'flex flex-col items-center gap-3 py-4',
  /** Outer ring — animated pulse */
  ringOuter: [
    'relative flex items-center justify-center',
    'w-20 h-20',
  ].join(' '),
  /** Animated ring that pulses behind the icon */
  ringPulse: [
    'absolute inset-0 rounded-full',
    'border-2 border-accent/30',
    'animate-ring-pulse',
  ].join(' '),
  /** Icon container */
  iconWrap: [
    'relative z-10',
    'w-16 h-16 rounded-2xl',
    'bg-accent/10 border border-accent/20',
    'flex items-center justify-center',
    'text-accent',
  ].join(' '),
  title: 'text-xl font-semibold text-default text-center',
  description: 'text-sm text-muted text-center leading-relaxed',
} as const;

/* ---------------------------------------------------------------------------
   ORIGIN BADGE (dapp URL indicator)
   --------------------------------------------------------------------------- */

export const originStyles = {
  wrap: 'flex items-center gap-2 mb-4',
  label: 'text-xs text-muted',
  badge: [
    'inline-flex items-center gap-1.5',
    'px-2.5 py-1 rounded-full',
    'bg-blue-500/10 text-blue-500',
    'text-xs font-medium',
    'border border-blue-500/20',
  ].join(' '),
} as const;

/* ---------------------------------------------------------------------------
   DETAIL CARD (tx / read summary)
   --------------------------------------------------------------------------- */

export const detailCardStyles = {
  card: [
    'rounded-xl',
    'bg-surface-secondary border border-default',
    'p-4',
    'flex flex-col gap-2.5',
  ].join(' '),
  row: 'flex items-start justify-between gap-2',
  label: 'text-xs font-medium text-muted shrink-0 pt-0.5',
  value: [
    'text-xs font-mono text-default',
    'text-right break-all',
  ].join(' '),
  methodBadge: [
    'inline-flex items-center',
    'px-2 py-0.5 rounded-md',
    'bg-accent/10 text-accent',
    'text-xs font-medium',
  ].join(' '),
} as const;

/* ---------------------------------------------------------------------------
   BUTTONS
   --------------------------------------------------------------------------- */

export const buttonStyles = {
  /** Full-width primary CTA */
  primary: [
    'w-full flex items-center justify-center gap-2',
    'px-4 py-3 rounded-xl',
    'gradient-primary text-on-accent',
    'text-sm font-semibold',
    'shadow-theme hover:shadow-theme-hover',
    'hover:scale-[1.01] active:scale-[0.99]',
    'transition-all duration-200',
    'cursor-pointer',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100',
  ].join(' '),
  /** Full-width ghost / cancel button */
  ghost: [
    'w-full flex items-center justify-center gap-2',
    'px-4 py-2.5 rounded-xl',
    'bg-transparent text-muted',
    'text-sm font-medium',
    'hover:bg-surface-secondary hover:text-default',
    'transition-all duration-200',
    'cursor-pointer',
    'border border-transparent hover:border-default',
  ].join(' '),
  /** Full-width danger (reject) button */
  danger: [
    'w-full flex items-center justify-center gap-2',
    'px-4 py-2.5 rounded-xl',
    'bg-transparent text-red-500',
    'text-sm font-medium',
    'border border-red-500/30',
    'hover:bg-red-500/10 hover:border-red-500/60',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  /** Loading spinner inline */
  spinner: 'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
} as const;

/* ---------------------------------------------------------------------------
   ERROR STATE
   --------------------------------------------------------------------------- */

export const errorStyles = {
  wrap: [
    'flex items-start gap-2.5',
    'px-3 py-2.5 rounded-lg',
    'bg-red-500/8 border border-red-500/20',
  ].join(' '),
  icon: 'text-red-500 shrink-0 mt-0.5',
  message: 'text-xs text-red-500 leading-relaxed',
} as const;

/* ---------------------------------------------------------------------------
   TRUST / SECURITY BADGE
   --------------------------------------------------------------------------- */

export const trustBadgeStyles = {
  wrap: 'flex items-center justify-center gap-1.5 mt-2',
  icon: 'text-muted',
  text: 'text-xs text-muted',
} as const;

/* ---------------------------------------------------------------------------
   INFO ROW (for read flow — less alarming)
   --------------------------------------------------------------------------- */

export const infoStyles = {
  wrap: [
    'flex items-start gap-2.5',
    'px-3 py-2.5 rounded-lg',
    'bg-blue-500/8 border border-blue-500/20',
    'mb-4',
  ].join(' '),
  icon: 'text-blue-500 shrink-0 mt-0.5',
  text: 'text-xs text-blue-600 leading-relaxed',
} as const;

/* ---------------------------------------------------------------------------
   LOADING SHELL (waiting for POPUP_INIT)
   --------------------------------------------------------------------------- */

export const loadingStyles = {
  shell: 'min-h-screen bg-page flex flex-col items-center justify-center gap-4',
  spinner: [
    'w-8 h-8 rounded-full',
    'border-2 border-default border-t-accent',
    'animate-spin',
  ].join(' '),
  text: 'text-sm text-muted',
} as const;
