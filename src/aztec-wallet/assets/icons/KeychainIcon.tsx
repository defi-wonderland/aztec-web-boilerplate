import type { WalletIconProps } from './types';

export const KeychainIcon = ({
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
    <rect width="40" height="40" rx="8" fill="#5B21B6" />
    {/* Key body */}
    <circle
      cx="15"
      cy="16"
      r="6"
      stroke="white"
      strokeWidth="2"
      fill="none"
    />
    <circle cx="15" cy="16" r="2" fill="white" />
    {/* Key shaft */}
    <line
      x1="21"
      y1="16"
      x2="32"
      y2="16"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Key teeth */}
    <line
      x1="28"
      y1="16"
      x2="28"
      y2="21"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="32"
      y1="16"
      x2="32"
      y2="21"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Shield outline */}
    <path
      d="M14 24 L20 22 L26 24 L26 30 Q20 34 14 30 Z"
      stroke="white"
      strokeWidth="1.5"
      fill="rgba(255,255,255,0.15)"
      strokeLinejoin="round"
    />
  </svg>
);
