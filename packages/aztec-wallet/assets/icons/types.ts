import type { SVGProps } from 'react';

/**
 * Base props for all wallet icon components
 */
export interface WalletIconProps extends SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Defaults to 24 */
  size?: number;
}
