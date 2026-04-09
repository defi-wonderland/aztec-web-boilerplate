/**
 * =============================================================================
 * POPUP INLINE STYLES
 * =============================================================================
 *
 * Native CSS-in-JS styles for the passkey popup window. Uses React
 * CSSProperties instead of Tailwind classes so the popup can be built
 * with esbuild without any PostCSS/Tailwind processing.
 *
 * Theme tokens are embedded directly as CSS variable references matching
 * the CSS custom properties injected via <style> in popupGlobalCSS below.
 */

import type { CSSProperties } from 'react';

/* ---------------------------------------------------------------------------
   GLOBAL CSS (injected into <head> at mount time)
   --------------------------------------------------------------------------- */

/**
 * Global CSS string injected into the popup document's <head>.
 * Contains CSS variables, base resets, animations, and font import.
 */
export const popupGlobalCSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  --bg-primary: #ffffff;
  --bg-secondary: #eeedf1;
  --bg-tertiary: #f8f7fa;
  --bg-gradient-start: #f8f7fa;
  --bg-gradient-end: #ffffff;
  --text-primary: #321e4c;
  --text-secondary: #5a4a6b;
  --text-muted: #8b7a9b;
  --accent-primary: #8c7eff;
  --accent-secondary: #eda1ff;
  --border-color: #d4d1db;
  --shadow-color: rgba(50, 30, 76, 0.1);
  --button-text: #eeedf1;
  --bg-page: #f8f7fa;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: linear-gradient(180deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
  color: var(--text-primary);
}

@keyframes fade-slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes ring-pulse {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(1.6); opacity: 0; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
`;

/* ---------------------------------------------------------------------------
   LAYOUT
   --------------------------------------------------------------------------- */

export const layoutStyles = {
  shell: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-page)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  } as CSSProperties,

  card: {
    width: '100%',
    maxWidth: '384px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    boxShadow: '0 0.5rem 1.5rem var(--shadow-color)',
    padding: '24px',
    animation: 'fade-slide-up 0.3s ease-out forwards',
  } as CSSProperties,

  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  } as CSSProperties,
};

/* ---------------------------------------------------------------------------
   HEADER / BRANDING
   --------------------------------------------------------------------------- */

export const headerStyles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '24px',
  } as CSSProperties,

  logoWrap: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'linear-gradient(180deg, var(--accent-primary) 0%, color-mix(in srgb, var(--accent-primary) 85%, black) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px var(--shadow-color)',
  } as CSSProperties,

  logoText: {
    color: 'var(--button-text)',
    fontWeight: 700,
    fontSize: '14px',
  } as CSSProperties,

  wordmark: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  } as CSSProperties,
};

/* ---------------------------------------------------------------------------
   ILLUSTRATION AREA (biometric icon etc.)
   --------------------------------------------------------------------------- */

export const illustrationStyles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 0',
  } as CSSProperties,

  ringOuter: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '80px',
    height: '80px',
  } as CSSProperties,

  ringPulse: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: '2px solid rgba(140, 126, 255, 0.3)',
    animation: 'ring-pulse 1.5s ease-out infinite',
  } as CSSProperties,

  iconWrap: {
    position: 'relative',
    zIndex: 10,
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    backgroundColor: 'rgba(140, 126, 255, 0.1)',
    border: '1px solid rgba(140, 126, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent-primary)',
  } as CSSProperties,

  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textAlign: 'center',
  } as CSSProperties,

  description: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    lineHeight: 1.6,
  } as CSSProperties,
};

/* ---------------------------------------------------------------------------
   ORIGIN BADGE (dapp URL indicator)
   --------------------------------------------------------------------------- */

export const originStyles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  } as CSSProperties,

  label: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  } as CSSProperties,

  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '9999px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: '#3b82f6',
    fontSize: '12px',
    fontWeight: 500,
    border: '1px solid rgba(59, 130, 246, 0.2)',
  } as CSSProperties,
};

/* ---------------------------------------------------------------------------
   DETAIL CARD (tx / read summary)
   --------------------------------------------------------------------------- */

export const detailCardStyles = {
  card: {
    borderRadius: '12px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  } as CSSProperties,

  row: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '8px',
  } as CSSProperties,

  label: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-muted)',
    flexShrink: 0,
    paddingTop: '2px',
  } as CSSProperties,

  value: {
    fontSize: '12px',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    color: 'var(--text-primary)',
    textAlign: 'right',
    wordBreak: 'break-all',
  } as CSSProperties,

  methodBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '6px',
    backgroundColor: 'rgba(140, 126, 255, 0.1)',
    color: 'var(--accent-primary)',
    fontSize: '12px',
    fontWeight: 500,
  } as CSSProperties,
};

/* ---------------------------------------------------------------------------
   BUTTONS
   --------------------------------------------------------------------------- */

export const buttonStyles = {
  primary: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '12px',
    background: 'linear-gradient(180deg, var(--accent-primary) 0%, color-mix(in srgb, var(--accent-primary) 85%, black) 100%)',
    color: 'var(--button-text)',
    fontSize: '14px',
    fontWeight: 600,
    boxShadow: '0 2px 8px var(--shadow-color)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as CSSProperties,

  ghost: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '12px',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '14px',
    fontWeight: 500,
    border: '1px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as CSSProperties,

  danger: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '12px',
    backgroundColor: 'transparent',
    color: '#ef4444',
    fontSize: '14px',
    fontWeight: 500,
    border: '1px solid rgba(239, 68, 68, 0.3)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as CSSProperties,

  spinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid currentColor',
    borderTopColor: 'transparent',
    animation: 'spin 0.6s linear infinite',
  } as CSSProperties,
};

/* ---------------------------------------------------------------------------
   ERROR STATE
   --------------------------------------------------------------------------- */

export const errorStyles = {
  wrap: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
  } as CSSProperties,

  icon: {
    color: '#ef4444',
    flexShrink: 0,
    marginTop: '2px',
  } as CSSProperties,

  message: {
    fontSize: '12px',
    color: '#ef4444',
    lineHeight: 1.6,
  } as CSSProperties,
};

/* ---------------------------------------------------------------------------
   TRUST / SECURITY BADGE
   --------------------------------------------------------------------------- */

export const trustBadgeStyles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '8px',
  } as CSSProperties,

  icon: {
    color: 'var(--text-muted)',
  } as CSSProperties,

  text: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  } as CSSProperties,
};

/* ---------------------------------------------------------------------------
   INFO ROW (for read flow -- less alarming)
   --------------------------------------------------------------------------- */

export const infoStyles = {
  wrap: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    marginBottom: '16px',
  } as CSSProperties,

  icon: {
    color: '#3b82f6',
    flexShrink: 0,
    marginTop: '2px',
  } as CSSProperties,

  text: {
    fontSize: '12px',
    color: '#2563eb',
    lineHeight: 1.6,
  } as CSSProperties,
};

/* ---------------------------------------------------------------------------
   PERMISSION REVIEW
   --------------------------------------------------------------------------- */

export const permissionStyles = {
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  } as CSSProperties,

  permissionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    marginBottom: '6px',
  } as CSSProperties,

  permissionIcon: {
    fontSize: '16px',
    flexShrink: 0,
  } as CSSProperties,

  permissionTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
  } as CSSProperties,

  permissionDesc: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  } as CSSProperties,

  contractCard: {
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    marginBottom: '6px',
  } as CSSProperties,

  contractHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  } as CSSProperties,

  contractAddress: {
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    color: 'var(--text-primary)',
  } as CSSProperties,

  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
    paddingLeft: '28px',
  } as CSSProperties,

  readBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    borderRadius: '8px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: '#3b82f6',
    fontSize: '10px',
    fontWeight: 600,
    flexShrink: 0,
  } as CSSProperties,

  writeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    borderRadius: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    fontSize: '10px',
    fontWeight: 600,
    flexShrink: 0,
  } as CSSProperties,

  functionList: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  } as CSSProperties,

  warningBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '12px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    color: '#f59e0b',
    fontSize: '11px',
    fontWeight: 600,
    marginBottom: '12px',
  } as CSSProperties,

  warningApproveButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '12px',
    backgroundColor: '#f59e0b',
    color: '#1a1a2e',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  } as CSSProperties,
};

/* ---------------------------------------------------------------------------
   LOADING SHELL (waiting for POPUP_INIT)
   --------------------------------------------------------------------------- */

export const loadingStyles = {
  shell: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-page)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  } as CSSProperties,

  spinner: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '2px solid var(--border-color)',
    borderTopColor: 'var(--accent-primary)',
    animation: 'spin 0.6s linear infinite',
  } as CSSProperties,

  text: {
    fontSize: '14px',
    color: 'var(--text-muted)',
  } as CSSProperties,
};
