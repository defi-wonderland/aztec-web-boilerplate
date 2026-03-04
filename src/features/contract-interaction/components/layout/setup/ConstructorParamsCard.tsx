import React, { useCallback } from 'react';
import { Rocket } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../../../../components/ui';
import { useFormActions, useFormValues } from '../../../../../store/form';
import { cn, iconSize } from '../../../../../utils';
import { useContractActions } from '../../../store';
import { ParameterInputs } from '../../ParameterInputs';
import type {
  ContractConstructor,
  DeployableContract,
} from '../../../../../utils/deployableContracts';

const styles = {
  // Constructor selector
  formGroup: 'flex flex-col gap-2',
  sectionLabel: 'text-sm font-bold text-default uppercase tracking-wide',
  // Constructor params card
  section: cn('rounded-2xl border border-default bg-surface overflow-hidden'),
  header: cn(
    'flex items-center gap-2.5 px-5 py-3.5',
    'border-b border-default'
  ),
  icon: 'text-accent',
  title: 'text-sm font-semibold text-default',
  content: 'flex flex-col gap-4 p-5',
  hint: 'text-sm text-muted',
} as const;

interface ConstructorParamsCardProps {
  deployable: DeployableContract;
  selectedConstructor: ContractConstructor;
  isDeploying: boolean;
}

export const ConstructorParamsCard: React.FC<ConstructorParamsCardProps> = ({
  deployable,
  selectedConstructor: ctor,
  isDeploying,
}) => {
  const formValues = useFormValues();
  const { setSelectedConstructor } = useContractActions();
  const { setValue: setFormValue, reset: resetFormValues } = useFormActions();

  const inputs = ctor.inputs;
  const hasNoInputs =
    inputs.filter((i) => i.type.kind !== 'struct').length === 0;

  const handleConstructorChange = useCallback(
    (value: string) => {
      setSelectedConstructor(value || null);
      resetFormValues();
    },
    [setSelectedConstructor, resetFormValues]
  );

  const handleParamChange = useCallback(
    (paramName: string, value: string) => {
      setFormValue(paramName, value);
    },
    [setFormValue]
  );

  return (
    <>
      {/* Constructor selector (show when multiple constructors) */}
      {deployable.constructors.length > 1 && (
        <div className={styles.formGroup}>
          <label htmlFor="constructor-select" className={styles.sectionLabel}>
            Constructor
          </label>
          <Select
            value={ctor.name}
            onValueChange={handleConstructorChange}
            disabled={isDeploying}
          >
            <SelectTrigger id="constructor-select">
              <SelectValue placeholder="Select a constructor..." />
            </SelectTrigger>
            <SelectContent>
              {deployable.constructors.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Constructor parameters */}
      <div className={styles.section}>
        <div className={styles.header}>
          <Rocket size={iconSize('md')} className={styles.icon} />
          <span className={styles.title}>Constructor Parameters</span>
        </div>
        <div className={styles.content}>
          {hasNoInputs && (
            <p className={styles.hint}>
              This constructor requires no parameters.
            </p>
          )}
          <ParameterInputs
            inputs={inputs}
            values={formValues}
            onChange={handleParamChange}
            disabled={isDeploying}
            idPrefix="param"
          />
        </div>
      </div>
    </>
  );
};
