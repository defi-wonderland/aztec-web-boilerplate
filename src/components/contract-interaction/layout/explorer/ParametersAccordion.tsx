import React, { useCallback } from 'react';
import { Circle } from 'lucide-react';
import { useFormValues, useFormActions } from '../../../../store';
import { cn, iconSize, toTitleCase } from '../../../../utils';
import { formatParsedType } from '../../../../utils/contractInteraction';
import { Button, Input } from '../../../ui';
import type { ParsedField } from '../../../../types';

interface ParametersAccordionProps {
  inputs: ParsedField[];
  connectedAddress: string;
  isBusy: boolean;
}

const styles = {
  accordion: cn(
    'flex flex-col flex-shrink-0',
    'rounded-2xl overflow-hidden',
    'bg-surface border border-default'
  ),
  accordionHeader: cn(
    'flex items-center justify-between',
    'px-5 py-4',
    'border-b border-default'
  ),
  accordionHeaderLeft: 'flex items-center gap-2.5',
  accordionIcon: 'text-accent',
  accordionTitle: 'text-sm font-semibold text-default',
  accordionCount: cn(
    'px-2 py-0.5 rounded-full',
    'bg-surface-tertiary',
    'text-[11px] font-medium text-muted'
  ),
  accordionContent: cn(
    'flex flex-col gap-5 p-5',
    'max-h-[400px] overflow-y-auto',
    'scrollbar-accent'
  ),

  // Parameter input
  paramGroup: 'flex flex-col gap-2 w-full',
  paramHeader: 'flex items-center justify-between w-full',
  paramLeft: 'flex items-center gap-2',
  paramLabel: 'text-sm font-medium text-default',
  paramRequired: 'text-error',
  paramType: 'text-xs font-mono text-muted',
  paramInputWrapper: 'flex items-center gap-2 w-full',
  paramInput: cn(
    'flex-1 h-12 px-4 rounded-[10px]',
    'bg-surface border border-default',
    'text-[13px] font-mono text-default',
    'placeholder:text-muted',
    'focus:outline-none focus:border-accent focus:border-2',
    'transition-colors'
  ),
  paramHelper: cn(
    'flex items-center gap-1.5',
    'px-3 py-2.5 rounded-lg',
    'bg-accent/10',
    'cursor-pointer hover:bg-accent/15 transition-colors'
  ),
  paramHelperText: 'text-xs font-medium text-accent',
  noParams: 'text-sm text-muted',
} as const;

export const ParametersAccordion: React.FC<ParametersAccordionProps> = ({
  inputs,
  connectedAddress,
  isBusy,
}) => {
  const formValues = useFormValues();
  const { setValue: setFormValue } = useFormActions();

  const handleChange = useCallback(
    (path: string, value: string) => {
      setFormValue(path, value);
    },
    [setFormValue]
  );

  const requiredCount = inputs.filter(
    (input) => !input.path.includes('?')
  ).length;

  return (
    <div className={styles.accordion}>
      <div className={styles.accordionHeader}>
        <div className={styles.accordionHeaderLeft}>
          <Circle
            size={iconSize()}
            className={styles.accordionIcon}
            fill="currentColor"
          />
          <span className={styles.accordionTitle}>Parameters</span>
          <span className={styles.accordionCount}>
            {requiredCount} required
          </span>
        </div>
      </div>
      <div className={styles.accordionContent}>
        {inputs.length === 0 && (
          <p className={styles.noParams}>
            This function has no parameters. Click Simulate or Execute to run
            it.
          </p>
        )}
        {inputs.length > 0 &&
          inputs.map((input) => {
            const value = formValues[input.path] ?? '';
            const isRequired = !input.path.includes('?');

            return (
              <div key={input.path} className={styles.paramGroup}>
                <div className={styles.paramHeader}>
                  <div className={styles.paramLeft}>
                    <span className={styles.paramLabel}>
                      {toTitleCase(input.path)}
                      {isRequired && (
                        <span className={styles.paramRequired}> *</span>
                      )}
                    </span>
                  </div>
                  <span className={styles.paramType}>
                    {formatParsedType(input.type)}
                  </span>
                </div>
                <div className={styles.paramInputWrapper}>
                  <Input
                    className={styles.paramInput}
                    value={value}
                    onChange={(e) => handleChange(input.path, e.target.value)}
                    placeholder={`Enter ${toTitleCase(input.path)} value...`}
                    disabled={isBusy}
                  />
                  {input.path === 'from' && connectedAddress && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={styles.paramHelper}
                      onClick={() => handleChange(input.path, connectedAddress)}
                    >
                      <span className={styles.paramHelperText}>Use wallet</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
