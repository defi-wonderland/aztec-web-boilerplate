import React, { useCallback, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  Circle,
  FileCode,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { useCopyToClipboard } from '../../../hooks';
import {
  useViewMode,
  useSidebarSelectedId,
  useSelectedFunctionName,
  useFunctionFilter,
  useExplorerActions,
} from '../../../store';
import { cn, iconSize, truncateAddress } from '../../../utils';
import { Button, Input } from '../../ui';
import type { FunctionGroup } from '../types';

/**
 * Pixel-perfect styles matching Pencil design "Contracts UI V2 - Light"
 */
const styles = {
  // Sidebar container - 280px width, bg-surface (#F4F4F5), border-right
  sidebar: cn(
    'flex flex-col w-[280px] min-w-[280px]',
    'bg-surface h-full',
    'border-r border-default'
  ),

  // === Sidebar Header ===
  header: cn('flex flex-col gap-3', 'px-5 py-4', 'border-b border-default'),
  // Back row: "← Change Contract" link
  backRow: cn('flex items-center gap-1.5', 'cursor-pointer group'),
  backIcon: 'text-accent group-hover:text-accent/80 transition-colors',
  backText: cn(
    'text-xs font-medium text-accent',
    'group-hover:text-accent/80 transition-colors'
  ),
  // Title row: "Explorer" + add button
  titleRow: 'flex items-center justify-between w-full',
  sidebarTitle: 'text-sm font-bold text-default font-display',
  addBtn: cn(
    'flex items-center justify-center',
    'w-7 h-7 rounded-md',
    'bg-surface-tertiary hover:bg-surface-secondary',
    'transition-colors cursor-pointer'
  ),
  addIcon: 'text-muted',

  // === Contract Section ===
  contractSection: cn(
    'flex flex-col gap-0.5',
    'px-4 py-3',
    'border-b border-default'
  ),
  contractHeader: 'flex items-center justify-between w-full',
  contractHeaderLeft: 'flex items-center gap-2',
  contractName: 'text-[13px] font-semibold text-default font-mono',
  contractIcon: cn(
    'flex items-center justify-center',
    'w-6 h-6 rounded-md',
    'bg-accent/10'
  ),
  contractIconInner: 'text-accent',
  contractStatus: 'w-2 h-2 rounded-full status-dot',
  chevronIcon: 'text-muted',
  contractAddrRow: 'flex items-center gap-1.5',
  contractAddr: 'text-[11px] font-mono text-muted',
  contractCopyBtn: cn(
    'flex items-center justify-center',
    'w-5 h-5 rounded',
    'text-muted hover:text-accent hover:bg-surface-tertiary',
    'transition-colors cursor-pointer'
  ),
  contractCopySuccess: 'text-success',

  // === Search Section ===
  searchSection: 'px-4 py-3',
  searchBox: cn(
    'flex items-center gap-2',
    'h-9 px-2.5 rounded-lg',
    'bg-surface-tertiary'
  ),
  searchIcon: 'text-muted flex-shrink-0',
  searchInput: cn(
    'flex-1 bg-transparent border-none outline-none',
    'text-xs text-default placeholder:text-muted',
    'font-normal'
  ),

  // === Function Tree ===
  functionTree: cn(
    'flex flex-col gap-0.5',
    'flex-1 overflow-y-auto',
    'px-2 pb-4',
    'scrollbar-accent'
  ),

  // Function group
  group: 'flex flex-col',
  groupHeader: cn(
    'flex items-center gap-1.5',
    'py-2 px-3',
    'cursor-pointer select-none'
  ),
  groupChevron: 'text-muted',
  groupLabel: cn('text-[10px] font-bold text-muted', 'uppercase tracking-wide'),
  groupCount: cn(
    'px-1.5 py-0.5 rounded',
    'bg-surface-tertiary',
    'text-[10px] font-semibold text-muted'
  ),

  // Function items
  functionItem: cn(
    'flex items-center gap-2',
    'h-8 pl-7 pr-3 rounded-md',
    'cursor-pointer transition-all duration-150'
  ),
  functionItemDefault: 'hover:bg-surface-tertiary',
  functionItemSelected: cn('bg-accent/10', 'border border-accent'),
  functionIcon: 'flex-shrink-0',
  functionIconDefault: 'text-muted',
  functionIconSelected: 'text-accent',
  functionName: 'text-xs font-medium font-mono truncate',
  functionNameDefault: 'text-muted',
  functionNameSelected: 'text-accent',

  // Empty group text
  emptyGroupText: 'pl-7 py-2 text-xs text-muted',

  // Empty state
  emptyState: cn(
    'flex flex-col items-center justify-center',
    'py-8 px-4 text-center'
  ),
  emptyText: 'text-sm text-muted',

  // === Setup Mode: Contracts List ===
  setupHeader: cn('px-5 py-4', 'border-b border-default'),
  setupTitle: 'text-sm font-bold text-default font-display',

  contractsList: cn(
    'flex flex-col gap-1.5',
    'flex-1 overflow-y-auto',
    'p-4',
    'scrollbar-accent'
  ),

  contractItem: cn(
    'flex text-start gap-2.5',
    'px-3 py-2.5 rounded-lg',
    'cursor-pointer transition-colors'
  ),
  contractItemDefault: 'hover:bg-surface-tertiary',
  contractItemSelected: 'bg-accent/10',

  contractItemIcon: cn(
    'flex items-center justify-center',
    'w-[18px] h-[18px] flex-shrink-0',
    'self-start mt-[3px]'
  ),
  contractItemIconPreconfigured: 'text-accent',
  contractItemIconSaved: 'text-muted',

  contractItemInfo: 'flex flex-col gap-0.5 flex-1 min-w-0 overflow-hidden',
  contractItemName: 'text-[13px] font-semibold text-default truncate',
  contractItemAddr: 'text-[11px] font-mono text-muted truncate',
  contractItemDelete: cn(
    'flex items-center justify-center',
    'w-6 h-6 rounded-md flex-shrink-0',
    'text-muted/50',
    'hover:text-red-500 hover:bg-red-500/15',
    'transition-colors duration-150 cursor-pointer'
  ),

  addContractBtn: cn(
    'flex items-center gap-2',
    'px-3 py-2.5 rounded-lg',
    'cursor-pointer transition-colors'
  ),
  addContractBtnDefault: 'bg-accent/10 hover:bg-accent/15',
  addContractBtnSelected: 'bg-accent/15',
  addContractIcon: 'text-accent',
  addContractText: 'text-[13px] font-semibold text-default',
} as const;

export interface SidebarContract {
  id: string;
  name: string;
  address: string;
  type: 'preconfigured' | 'saved';
}

interface ContractSidebarProps {
  contracts: SidebarContract[];
  selectedContract: SidebarContract | null;
  functionGroups: FunctionGroup[];
  onBack: () => void;
  onAddContract: () => void;
  onSelectContract: (id: string) => void;
  onDeleteContract?: (contract: SidebarContract) => void;
}

export const ContractSidebar: React.FC<ContractSidebarProps> = ({
  contracts,
  selectedContract,
  functionGroups,
  onBack,
  onAddContract,
  onSelectContract,
  onDeleteContract,
}) => {
  const viewMode = useViewMode();
  const sidebarSelectedId = useSidebarSelectedId();
  const selectedFunctionName = useSelectedFunctionName();
  const functionFilter = useFunctionFilter();
  const { setSelectedFunctionName, setFunctionFilter } = useExplorerActions();

  const isSetupSelected = viewMode === 'setup';

  // Count functions in each group
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    functionGroups.forEach((group) => {
      counts[group.id] = group.items.length;
    });
    return counts;
  }, [functionGroups]);

  // Track collapsed groups (all groups expanded by default)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  const toggleGroupCollapsed = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const { copied: addressCopied, copy: copyAddress } = useCopyToClipboard();

  const handleCopyAddress = useCallback(() => {
    if (selectedContract?.address) {
      copyAddress(selectedContract.address);
    }
  }, [selectedContract, copyAddress]);

  const getContractIcon = (contract: SidebarContract) => {
    const iconClass =
      contract.type === 'preconfigured'
        ? styles.contractItemIconPreconfigured
        : styles.contractItemIconSaved;
    return <FileCode size={18} className={iconClass} />;
  };

  // If in setup mode, show contracts list sidebar
  if (isSetupSelected || !selectedContract) {
    return (
      <aside className={styles.sidebar}>
        {/* Header with "Contracts" title */}
        <div className={styles.setupHeader}>
          <span className={styles.setupTitle}>Contracts</span>
        </div>

        {/* Contracts List */}
        <div className={styles.contractsList}>
          {contracts.map((contract) => {
            const isSelected = sidebarSelectedId === contract.id;
            const canDelete = onDeleteContract !== undefined;
            return (
              <button
                key={contract.id}
                type="button"
                className={cn(
                  styles.contractItem,
                  isSelected
                    ? styles.contractItemSelected
                    : styles.contractItemDefault
                )}
                onClick={() => onSelectContract(contract.id)}
              >
                <span className={styles.contractItemIcon}>
                  {getContractIcon(contract)}
                </span>
                <div className={styles.contractItemInfo} title={contract.name}>
                  <span className={styles.contractItemName}>
                    {contract.name}
                  </span>
                  <span className={styles.contractItemAddr}>
                    {truncateAddress(contract.address)}
                  </span>
                </div>
                {canDelete && (
                  <Button
                    variant="icon"
                    size="icon"
                    className={styles.contractItemDelete}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteContract(contract);
                    }}
                    aria-label="Remove contract"
                    title="Remove contract"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </button>
            );
          })}

          {/* Add Contract button */}
          <button
            type="button"
            className={cn(
              styles.addContractBtn,
              sidebarSelectedId === null
                ? styles.addContractBtnSelected
                : styles.addContractBtnDefault
            )}
            onClick={onAddContract}
          >
            <Plus size={18} className={styles.addContractIcon} />
            <span className={styles.addContractText}>Add Contract</span>
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.sidebar}>
      {/* Header with back button and title */}
      <div className={styles.header}>
        <button type="button" className={styles.backRow} onClick={onBack}>
          <ArrowLeft size={iconSize()} className={styles.backIcon} />
          <span className={styles.backText}>Change Contract</span>
        </button>
        <div className={styles.titleRow}>
          <span className={styles.sidebarTitle}>Explorer</span>
          <button
            type="button"
            className={styles.addBtn}
            onClick={onAddContract}
            aria-label="Add contract"
          >
            <Plus size={iconSize()} className={styles.addIcon} />
          </button>
        </div>
      </div>

      {/* Contract Section */}
      <div className={styles.contractSection}>
        <div className={styles.contractHeader}>
          <div className={styles.contractHeaderLeft}>
            <span className={styles.contractName}>{selectedContract.name}</span>
            <div className={styles.contractIcon}>
              <FileCode size={12} className={styles.contractIconInner} />
            </div>
            <div className={styles.contractStatus} />
          </div>
        </div>
        <div className={styles.contractAddrRow}>
          <span className={styles.contractAddr}>
            {truncateAddress(selectedContract.address, 14, 6)}
          </span>
          <button
            type="button"
            className={cn(
              styles.contractCopyBtn,
              addressCopied && styles.contractCopySuccess
            )}
            onClick={handleCopyAddress}
            aria-label="Copy contract address"
            title="Copy address"
          >
            {addressCopied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchSection}>
        <div className={styles.searchBox}>
          <Search size={iconSize()} className={styles.searchIcon} />
          <Input
            className={styles.searchInput}
            placeholder="Search functions..."
            value={functionFilter}
            onChange={(e) => setFunctionFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Function Tree */}
      <div className={styles.functionTree}>
        {functionGroups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.id);
          const GroupChevron = isCollapsed ? ChevronRight : ChevronDown;

          return (
            <div key={group.id} className={styles.group}>
              {/* Group header */}
              <button
                type="button"
                className={styles.groupHeader}
                onClick={() => toggleGroupCollapsed(group.id)}
                aria-expanded={!isCollapsed}
              >
                <GroupChevron size={12} className={styles.groupChevron} />
                <span className={styles.groupLabel}>{group.label}</span>
                <span className={styles.groupCount}>
                  {groupCounts[group.id] ?? 0}
                </span>
              </button>

              {/* Function items - only show when expanded */}
              {!isCollapsed && (
                <>
                  {group.items.map((fn) => {
                    const isSelected = selectedFunctionName === fn.name;
                    return (
                      <button
                        key={fn.name}
                        type="button"
                        className={cn(
                          styles.functionItem,
                          isSelected
                            ? styles.functionItemSelected
                            : styles.functionItemDefault
                        )}
                        onClick={() => setSelectedFunctionName(fn.name)}
                        title={fn.name}
                      >
                        <Circle
                          size={6}
                          className={cn(
                            styles.functionIcon,
                            isSelected
                              ? styles.functionIconSelected
                              : styles.functionIconDefault
                          )}
                          fill="currentColor"
                        />
                        <span
                          className={cn(
                            styles.functionName,
                            isSelected
                              ? styles.functionNameSelected
                              : styles.functionNameDefault
                          )}
                        >
                          {fn.name}
                        </span>
                      </button>
                    );
                  })}

                  {group.items.length === 0 && (
                    <div className={styles.emptyGroupText}>
                      No functions found
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {functionGroups.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>No functions available.</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default ContractSidebar;
