import React, { useMemo, useState, useCallback } from 'react';
import { Play, Zap } from 'lucide-react';
import { useContractInvoker } from '../../../hooks/contracts';
import { usePreconfiguredContracts } from '../../../hooks/useInteractionContracts';
import {
  useContractTargetAddress,
  useContractActions,
  useInvokeFlowState,
  useFormValues,
  useFormActions,
} from '../../../store';
import { iconSize } from '../../../utils';
import {
  analyzeFunctionCapabilities,
  isValidAztecAddress,
} from '../../../utils/contractInteraction';
import { Button } from '../../ui';
import ExistingContractForm from './ExistingContractForm';
import FunctionForm from './FunctionForm';
import FunctionList from './FunctionList';
import PreconfiguredSelector from './PreconfiguredSelector';
import SavedContractsList from './SavedContractsList';
import type { AztecNetwork } from '../../../config/networks/constants';

const styles = {
  container: 'flex flex-col gap-6',
  grid: 'grid gap-6 lg:grid-cols-2',
  loaderCard:
    'flex flex-col gap-4 rounded-lg border border-default bg-surface-secondary p-4',
  hint: 'text-sm text-muted p-3 rounded-lg bg-blue-500/10 border border-blue-500/20',
  hintError:
    'text-sm text-red-500 p-3 rounded-lg bg-red-500/10 border border-red-500/20',
  actionRow: 'flex flex-wrap items-center gap-3 pt-4',
  errorInline: 'text-sm text-red-500',
} as const;

export interface InvokeFlowProps {
  networkName?: AztecNetwork;
  connectedAddress: string;
}

const InvokeFlow: React.FC<InvokeFlowProps> = ({
  networkName,
  connectedAddress,
}) => {
  const [selectedFnName, setSelectedFnName] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const {
    savedContracts,
    artifactInput,
    parseError,
    isLoadingPreconfigured,
    hasContract,
    hasCache,
    contractName,
    groups,
    status,
    error,
    onLoad,
    onSimulate,
    onExecute,
    onApplySaved,
    onDeleteSaved,
    onClearCache,
    onArtifactChange,
    onSelectPreconfigured,
  } = useContractInvoker({ networkName, filter });

  const address = useContractTargetAddress();
  const formValues = useFormValues();
  const { preconfiguredId } = useInvokeFlowState();
  const { setAddress } = useContractActions();
  const { setValue: setFormValue } = useFormActions();
  const preconfiguredContracts = usePreconfiguredContracts(networkName);

  const hasPreconfigured = preconfiguredContracts.length > 0;
  const isPreconfiguredMode = Boolean(preconfiguredId);
  const isCustomMode = !preconfiguredId;

  const canLoadExisting = isCustomMode
    ? Boolean(address && artifactInput)
    : isPreconfiguredMode && !isLoadingPreconfigured;

  const canClear =
    Boolean(hasCache || address || artifactInput || isPreconfiguredMode) &&
    !isLoadingPreconfigured;

  const selectedFn = useMemo(() => {
    if (!selectedFnName) return null;
    for (const group of groups) {
      const fn = group.items.find((f) => f.name === selectedFnName);
      if (fn) return fn;
    }
    return null;
  }, [groups, selectedFnName]);

  const capabilities = useMemo(
    () =>
      analyzeFunctionCapabilities(
        selectedFn?.attributes ?? [],
        selectedFn?.inputs
      ),
    [selectedFn]
  );

  const ownerMismatchWarning = useMemo(() => {
    if (!capabilities.isPrivate || !selectedFn || !connectedAddress)
      return false;
    const ownerInput = selectedFn.inputs.find(
      (input) => input.path === 'owner'
    );
    if (!ownerInput) return false;
    const ownerValue = formValues[ownerInput.path] ?? '';
    return (
      ownerValue !== '' &&
      ownerValue.toLowerCase() !== connectedAddress.toLowerCase()
    );
  }, [capabilities.isPrivate, selectedFn, connectedAddress, formValues]);

  const isBusy = status !== 'idle';
  const isSimulating = status === 'simulating';
  const isExecuting = status === 'executing';

  const simulateDisabled = !selectedFn || isBusy || !capabilities.canSimulate;
  const executeDisabled = !selectedFn || isBusy || !capabilities.isExecutable;

  const handleAddressChange = useCallback(
    (value: string) => {
      setAddress(value);
    },
    [setAddress]
  );

  const handleFormValueChange = useCallback(
    (path: string, value: string) => {
      setFormValue(path, value);
    },
    [setFormValue]
  );

  const handleSelectFunction = useCallback((name: string) => {
    setSelectedFnName(name);
  }, []);

  const handleFilterChange = useCallback((value: string) => {
    setFilter(value);
  }, []);

  const preconfiguredOptions = useMemo(
    () =>
      preconfiguredContracts.map((c) => ({
        id: c.id,
        label: c.label,
        address: c.address,
        artifactJson: c.artifactJson,
      })),
    [preconfiguredContracts]
  );

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        <div className={styles.loaderCard}>
          {hasPreconfigured && (
            <PreconfiguredSelector
              preconfigured={preconfiguredOptions}
              selectedId={preconfiguredId}
              onSelect={onSelectPreconfigured}
              isLoading={isLoadingPreconfigured}
            />
          )}

          <ExistingContractForm
            address={address}
            artifactInput={artifactInput}
            onAddressChange={handleAddressChange}
            onArtifactChange={onArtifactChange}
            onLoad={onLoad}
            error={parseError}
            isValidAddress={!address || isValidAztecAddress(address)}
            isPreconfiguredMode={isPreconfiguredMode}
            isLoadingPreconfigured={isLoadingPreconfigured}
            canLoad={canLoadExisting}
          />

          <SavedContractsList
            contracts={savedContracts}
            activeAddress={address}
            onApply={onApplySaved}
            onDelete={onDeleteSaved}
            onClearAll={onClearCache}
            canClear={canClear}
          />
        </div>

        <FunctionList
          groups={groups}
          selected={selectedFnName}
          onSelect={handleSelectFunction}
          filter={filter}
          onFilterChange={handleFilterChange}
          contractName={contractName}
          hasContract={hasContract}
        />
      </div>

      {selectedFn && (
        <FunctionForm
          fn={selectedFn}
          values={formValues}
          onChange={handleFormValueChange}
          disabled={isBusy}
        />
      )}

      {selectedFn && capabilities.isPrivate && (
        <p className={styles.hint} role="status">
          This is a private function. Results can only be proven by the note
          owner; querying other addresses will likely return 0 or fail.
        </p>
      )}

      {ownerMismatchWarning && (
        <p className={styles.hintError} role="alert">
          Owner differs from the connected wallet; private balances for other
          addresses will usually appear as 0.
        </p>
      )}

      <div className={styles.actionRow}>
        <Button
          variant="secondary"
          disabled={simulateDisabled}
          isLoading={isSimulating}
          onClick={() => selectedFnName && onSimulate(selectedFnName)}
          icon={<Play size={iconSize()} />}
        >
          {isSimulating ? 'Simulating...' : 'Simulate'}
        </Button>
        <Button
          variant="primary"
          disabled={executeDisabled}
          isLoading={isExecuting}
          onClick={() => selectedFnName && onExecute(selectedFnName)}
          icon={<Zap size={iconSize()} />}
        >
          {isExecuting ? 'Executing...' : 'Execute'}
        </Button>
        {error && (
          <span className={styles.errorInline} role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
};

export default InvokeFlow;
