import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { formatNumberCompact, formatNumberFull } from '../../../utils';

interface BalanceDisplayProps {
  balance: bigint;
  className?: string;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  balance,
  className,
}) => {
  const { value, isCompact } = formatNumberCompact(balance);
  const fullValue = formatNumberFull(balance);

  if (!isCompact) {
    return <span className={className}>{value}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>{value}</span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-mono">{fullValue} TST</span>
      </TooltipContent>
    </Tooltip>
  );
};
