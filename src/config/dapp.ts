/**
 * Shared dApp metadata configuration
 * Used across all wallet connectors for consistent branding
 */

export interface DappMetadata {
  name: string;
  description: string;
  url: string;
  icon: string;
}

/**
 * Get the dApp metadata with runtime URL resolution
 * This is a function because window is not available during SSR
 */
export const getDappMetadata = (): DappMetadata => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return {
    name: 'Aztec Web Boilerplate',
    description: 'Privacy-first application built on Aztec Network',
    url: origin,
    icon: origin ? `${origin}/favicon.ico` : '',
  };
};
