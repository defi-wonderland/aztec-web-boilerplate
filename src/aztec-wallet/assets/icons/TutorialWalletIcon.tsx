import type { WalletIconProps } from './types';

export const TutorialWalletIcon = ({
  size,
  className,
  ...props
}: WalletIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 40 40"
    width={size}
    height={size}
    className={className}
    fill="none"
    {...props}
  >
    <rect width="40" height="40" rx="8" fill="#7C3AED" />
    {/* Crystal ball */}
    <circle
      cx="20"
      cy="17"
      r="8"
      stroke="white"
      strokeWidth="1.5"
      fill="rgba(255,255,255,0.12)"
    />
    {/* Inner glow */}
    <circle cx="20" cy="17" r="4.5" fill="rgba(255,255,255,0.2)" />
    {/* Sparkle highlight */}
    <circle cx="17" cy="14" r="1.5" fill="rgba(255,255,255,0.6)" />
    {/* Small sparkle */}
    <circle cx="22" cy="13" r="0.8" fill="rgba(255,255,255,0.4)" />
    {/* Base / stand */}
    <path
      d="M14 25 Q17 27 20 27 Q23 27 26 25"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M15 28 L25 28 Q26 28 26 29 L26 30 Q26 31 25 31 L15 31 Q14 31 14 30 L14 29 Q14 28 15 28 Z"
      stroke="white"
      strokeWidth="1.2"
      fill="rgba(255,255,255,0.15)"
    />
    {/* Stand stem */}
    <line
      x1="20"
      y1="25"
      x2="20"
      y2="28"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
