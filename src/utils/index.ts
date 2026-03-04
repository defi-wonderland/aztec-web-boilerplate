import { hasHexPrefix } from '@aztec/foundation/string';
export { cn } from './cn';
export { downloadAsFile, copyToClipboard } from './file';
export {
  formatBalance,
  formatFeeJuiceBalance,
  formatRelativeTime,
  formatTime,
  formatDate,
  formatNumberCompact,
  formatNumberFull,
  formatPercentage,
  toTitleCase,
} from './formatting';
export { iconSize, type IconSize } from './iconSize';
export { queuePxeCall } from './pxeQueue';

// ============================================================================
// ADDRESS UTILITIES
// ============================================================================

const DEFAULT_TRUNCATE_START = 6;
const DEFAULT_TRUNCATE_END = 4;

export const truncateAddress = (
  address: string | undefined,
  startChars = DEFAULT_TRUNCATE_START,
  endChars = DEFAULT_TRUNCATE_END
): string => {
  if (!address) return '';
  const formattedAddress = hasHexPrefix(address) ? address : `0x${address}`;
  if (formattedAddress.length <= startChars + endChars) return formattedAddress;
  return `${formattedAddress.slice(0, startChars)}...${formattedAddress.slice(-endChars)}`;
};
