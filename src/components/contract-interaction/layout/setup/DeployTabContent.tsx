import React from 'react';
import { Rocket, FileEdit, Coins, ArrowLeft } from 'lucide-react';
import { cn, iconSize } from '../../../../utils';
import { Button } from '../../../ui';
import ArtifactInput from '../../ArtifactInput';
import ContractSourceCard from '../ContractSourceCard';
import ArtifactMethodSelector from './ArtifactMethodSelector';
import ConstructorParamsCard from './ConstructorParamsCard';
import type {
  ArtifactInputMethod,
  ContractSource,
  CustomDeployableResult,
} from './setup-utils';
import type {
  ContractConstructor,
  DeployableContract,
} from '../../../../utils/deployableContracts';

const styles = {
  section: 'flex flex-col gap-5',
  sectionLabel: 'text-sm font-bold text-default uppercase tracking-wide',
  cardsGrid: 'flex gap-3 flex-wrap',
  card: 'w-[220px]',
  // Custom artifact card
  detailsCard: cn(
    'rounded-2xl border border-default bg-surface',
    'overflow-hidden'
  ),
  detailsHeader: cn(
    'flex items-center justify-between',
    'px-5 py-3.5 border-b border-default'
  ),
  detailsTitle: 'text-sm font-semibold text-default',
  detailsBackBtn: cn(
    'flex items-center gap-1 text-xs font-medium text-accent',
    'cursor-pointer hover:text-accent/80 transition-colors'
  ),
  detailsContent: 'flex flex-col gap-4 p-5',
  hintError: 'text-sm text-error',
  hintWarning: 'text-sm text-warning',
  actionsRow: 'flex gap-4 pt-2',
} as const;

interface DeployTabContentProps {
  source: {
    isCustom: boolean;
    deployableContracts: DeployableContract[];
    selectedPreconfigured: DeployableContract | null;
    onSourceChange: (source: ContractSource) => void;
    onSelectDeployable: (contract: DeployableContract) => void;
  };
  customArtifact: {
    method: ArtifactInputMethod;
    value: string;
    parsed: CustomDeployableResult;
    onMethodChange: (method: ArtifactInputMethod) => void;
    onChange: (value: string) => void;
  };
  deploy: {
    deployable: DeployableContract | null;
    constructor: ContractConstructor | null;
    isDeploying: boolean;
    isFormValid: boolean;
    canDeploy: boolean;
    errorMessage: string | null;
    onDeploy: () => void;
  };
}

export const DeployTabContent: React.FC<DeployTabContentProps> = ({
  source,
  customArtifact,
  deploy,
}) => {
  return (
    <div className={styles.section}>
      <span className={styles.sectionLabel}>Select Contract to Deploy</span>
      <div className={styles.cardsGrid}>
        <ContractSourceCard
          icon={FileEdit}
          title="Custom Contract"
          description="Deploy from artifact"
          isSelected={source.isCustom}
          onClick={() => source.onSourceChange('custom')}
          className={styles.card}
        />
        {source.deployableContracts.map((contract) => (
          <ContractSourceCard
            key={contract.id}
            icon={Coins}
            title={contract.label}
            description="ERC20-like token"
            isSelected={
              !source.isCustom &&
              source.selectedPreconfigured?.id === contract.id
            }
            onClick={() => source.onSelectDeployable(contract)}
            className={styles.card}
          />
        ))}
      </div>

      {/* Custom artifact input for deployment */}
      {source.isCustom && (
        <div className={styles.detailsCard}>
          <div className={styles.detailsHeader}>
            <span className={styles.detailsTitle}>Contract Artifact</span>
            {customArtifact.method && (
              <button
                type="button"
                className={styles.detailsBackBtn}
                onClick={() => customArtifact.onMethodChange(null)}
              >
                <ArrowLeft size={12} />
                Change method
              </button>
            )}
          </div>
          <div className={styles.detailsContent}>
            {!customArtifact.method && (
              <ArtifactMethodSelector
                onSelect={customArtifact.onMethodChange}
              />
            )}

            {customArtifact.method && (
              <ArtifactInput
                id="custom-deploy-artifact"
                value={customArtifact.value}
                onChange={customArtifact.onChange}
                placeholder="Paste the compiled contract artifact JSON here"
                disabled={deploy.isDeploying}
                rows={12}
                inputMethod={customArtifact.method}
                error={customArtifact.parsed.error ?? undefined}
                helperText={
                  customArtifact.value &&
                  !deploy.deployable &&
                  !customArtifact.parsed.error
                    ? 'Provide a valid artifact to load constructors.'
                    : undefined
                }
              />
            )}
          </div>
        </div>
      )}

      {/* Constructor selector + parameters */}
      {deploy.deployable && deploy.constructor && (
        <ConstructorParamsCard
          deployable={deploy.deployable}
          constructor={deploy.constructor}
          isDeploying={deploy.isDeploying}
        />
      )}

      {deploy.errorMessage && (
        <p className={styles.hintError} role="alert">
          {deploy.errorMessage}
        </p>
      )}

      {!deploy.canDeploy && deploy.constructor && (
        <p className={styles.hintWarning} role="alert">
          Contract deployment is not yet supported for your wallet type.
        </p>
      )}

      <div className={styles.actionsRow}>
        <Button
          variant="primary"
          onClick={deploy.onDeploy}
          disabled={
            !deploy.canDeploy || !deploy.isFormValid || deploy.isDeploying
          }
          isLoading={deploy.isDeploying}
          icon={<Rocket size={iconSize()} />}
        >
          {deploy.isDeploying ? 'Deploying...' : 'Deploy Contract'}
        </Button>
      </div>
    </div>
  );
};

export default DeployTabContent;
