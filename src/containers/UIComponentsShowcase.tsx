import React, { useState } from 'react';
import {
  Layers,
  Copy,
  Rocket,
  X,
  Sun,
  Moon,
  Bell,
  Check,
  AlertTriangle,
  Info,
  XCircle,
  // Icon examples
  Home,
  Settings,
  User,
  Search,
  Heart,
  Star,
  Mail,
  Calendar,
  Camera,
  Download,
  Upload,
  Trash2,
  Edit,
  ExternalLink,
  BookOpen,
  // Wallet icons
  Wallet,
  ChevronDown,
  ChevronRight,
  Key,
  CreditCard,
  LogOut,
  Globe,
  FlaskConical,
  Box,
} from 'lucide-react';
import {
  useConnectModal,
  useAccountModal,
  useNetworkModal,
} from '../aztec-wallet';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Toggle,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../components/ui';
import { useToast } from '../hooks';
import { iconSize } from '../utils';

const styles = {
  headerRow: 'flex flex-row items-start gap-4',
  headerIcon: 'text-accent',
  // Sections
  sectionsContainer: 'space-y-8',
  section: 'space-y-4',
  sectionTitle:
    'text-lg font-semibold text-default border-b border-default pb-2',
  sectionDescription: 'text-sm text-muted',
  // Component showcase
  componentGrid: 'flex flex-wrap gap-3 items-center',
  componentGridWide: 'flex flex-wrap gap-4 items-center',
  componentRow: 'flex flex-wrap gap-3 items-end',
  componentColumn: 'flex flex-col gap-3',
  // Labels
  variantLabel: 'text-xs text-muted font-mono',
  // Tab content
  tabContent: 'p-4 bg-surface-secondary rounded-lg mt-2',
  // Dialog
  dialogBody: 'py-4',
  dialogText: 'text-default',
  // Card examples
  cardExample: 'max-w-xs',
  cardText: 'text-sm text-muted',
  cardTextDefault: 'text-sm text-default',
  // Icons section
  iconGrid: 'grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-4',
  iconItem: 'flex flex-col items-center gap-1',
  iconBox:
    'p-3 rounded-lg bg-surface-secondary hover:bg-surface-tertiary transition-colors',
  iconName: 'text-[10px] text-muted font-mono truncate max-w-full',
  link: 'text-accent hover:underline inline-flex items-center gap-1',
  // Guidelines section
  guidelineBox:
    'p-4 rounded-lg bg-surface-secondary border border-default space-y-2',
  guidelineTitle: 'font-semibold text-default flex items-center gap-2',
  guidelineText: 'text-sm text-muted',
  guidelineList: 'list-disc list-inside text-sm text-muted space-y-1 ml-2',
  // ========== AZTEC WALLET SHOWCASE STYLES ==========
  walletSection: 'space-y-5',
  walletSectionTitle:
    'text-lg font-semibold text-default border-b border-default pb-2 flex items-center gap-3',
  walletSectionSubtitle:
    'text-base font-semibold text-default border-b border-default pb-2 mt-4 mb-3',
  // ConnectButton styles (matching real ConnectButton.tsx)
  connectButtonDisconnected: [
    'group relative overflow-hidden',
    'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]',
    'hover:shadow-[0_0_20px_color-mix(in_srgb,var(--accent-primary)_40%,transparent)]',
    'transition-all duration-300',
  ].join(' '),
  walletIcon: 'transition-transform duration-300 group-hover:scale-110',
  connectButtonConnecting: [
    'relative',
    'bg-surface-secondary border-accent/50',
    'animate-shimmer',
  ].join(' '),
  connectingContent: 'flex items-center gap-2',
  connectButtonConnected: [
    'group flex items-center gap-2',
    'pl-2.5 pr-2 py-1.5 rounded-lg',
    'bg-surface-secondary hover:bg-surface-tertiary',
    'border border-default hover:border-accent/50',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  walletEmoji: 'text-base',
  walletAddress: 'font-mono text-sm text-default',
  walletChevron: 'text-muted transition-transform duration-200',
  walletContainer: 'flex items-center gap-3',
  // NetworkPicker styles (mockups)
  networkPickerFull: [
    'group flex items-center gap-2',
    'pl-2 pr-1.5 py-1.5 rounded-lg',
    'bg-surface-secondary hover:bg-surface-tertiary',
    'border border-default hover:border-accent/50',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  networkPickerCompact: [
    'group flex items-center justify-center',
    'h-9 w-9 rounded-lg',
    'bg-surface-secondary hover:bg-surface-tertiary',
    'border border-default hover:border-accent/50',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  networkIconContainer: [
    'flex items-center justify-center',
    'w-6 h-6 rounded-lg',
    'bg-accent/10',
    'transition-colors duration-200',
    'group-hover:bg-accent/20',
  ].join(' '),
  networkIcon: 'text-accent text-sm',
  networkName: 'text-sm font-semibold text-default',
  // Wallet Group Button styles (mockups for connect modal)
  walletGroupButton: [
    'group w-full flex items-center gap-4',
    'px-4 py-4 rounded-xl',
    'bg-surface-secondary hover:bg-surface-tertiary',
    'border border-transparent hover:border-accent/30',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  walletGroupIconContainer: [
    'flex items-center justify-center',
    'w-10 h-10 rounded-xl',
    'bg-accent/10',
    'text-accent',
    'transition-all duration-200',
    'group-hover:bg-accent/20',
  ].join(' '),
  walletGroupContent: 'flex-1 flex flex-col items-start gap-0.5',
  walletGroupLabel: 'text-sm font-semibold text-default',
  walletGroupDescription: 'text-xs text-muted',
  walletGroupRightSection: 'flex items-center gap-2',
  walletGroupArrow: [
    'text-muted',
    'transition-all duration-200',
    'group-hover:text-accent',
  ].join(' '),
  // Account Modal styles (mockups)
  accountModalHeader: 'flex flex-col items-center gap-3 pb-4',
  accountEmojiContainer: [
    'w-16 h-16 rounded-2xl',
    'bg-surface-secondary',
    'border border-default',
    'flex items-center justify-center',
    'text-4xl',
    'shadow-lg',
  ].join(' '),
  accountStatusBadge: [
    'inline-flex items-center gap-1.5',
    'px-2.5 py-1 rounded-full',
    'bg-green-500/10 text-green-500',
    'text-xs font-medium',
  ].join(' '),
  accountStatusDot: 'w-1.5 h-1.5 rounded-full bg-green-500',
  accountSection: 'flex flex-col gap-2',
  accountLabel: 'text-xs uppercase tracking-wider text-muted font-medium',
  accountAddressContainer: [
    'group relative flex items-center justify-between',
    'bg-surface-secondary px-4 py-3 rounded-xl',
    'border border-default',
  ].join(' '),
  accountAddressText: 'font-mono text-sm text-default tracking-tight',
  accountCopyButton: [
    'flex items-center justify-center',
    'w-8 h-8 rounded-lg',
    'bg-surface-tertiary hover:bg-accent/10',
    'text-muted hover:text-accent',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  accountNetworkContainer: [
    'flex items-center justify-between',
    'bg-surface-secondary px-4 py-3 rounded-xl',
    'border border-default',
  ].join(' '),
  accountNetworkInfo: 'flex items-center gap-3',
  accountNetworkIconContainer: [
    'flex items-center justify-center',
    'w-8 h-8 rounded-lg',
    'bg-accent/10 text-accent',
  ].join(' '),
  accountNetworkName: 'text-sm font-medium text-default',
  accountNetworkBadge: [
    'text-xs px-2 py-0.5 rounded-full',
    'bg-surface-tertiary text-muted',
  ].join(' '),
  accountDisconnectButton: [
    'w-full flex items-center justify-center gap-2',
    'px-4 py-2 rounded-lg',
    'bg-transparent hover:bg-red-500/10',
    'text-red-400 hover:text-red-500',
    'border border-red-500/20 hover:border-red-500/40',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  // Network Modal styles (mockups)
  networkModalButton: [
    'group w-full flex items-center gap-3',
    'px-4 py-3 rounded-xl',
    'bg-surface-secondary hover:bg-surface-tertiary',
    'border border-transparent hover:border-accent/30',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  networkModalButtonActive: 'border-accent/50 bg-accent/5 hover:bg-accent/10',
  networkModalIconContainer: [
    'flex items-center justify-center',
    'w-10 h-10 rounded-xl',
    'bg-surface-tertiary',
  ].join(' '),
  networkModalIconText: 'text-accent text-lg',
  networkModalName: 'text-sm font-medium text-default',
  networkModalSpacer: 'flex-1',
  networkModalCheck: 'text-green-500',
  // Modal preview container
  modalPreview: [
    'bg-surface rounded-2xl border border-default shadow-lg',
    'max-w-md w-full p-6',
  ].join(' '),
  modalPreviewTitle: 'text-lg font-semibold text-default',
  modalPreviewSubtitle: 'text-sm text-muted mt-1 mb-4',
  // Spinner
  spinner:
    'animate-spin rounded-full border-2 border-current border-t-transparent text-accent h-4 w-4',
  // Custom button example
  customConnectButton: [
    'px-4 py-2 rounded-lg font-medium',
    'bg-surface-secondary hover:bg-surface-tertiary',
    'border border-default hover:border-accent/50',
    'text-default',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  // Code block
  codeBlock: [
    'font-mono text-xs',
    'bg-surface-secondary px-3 py-2 rounded-lg',
    'border border-default',
    'text-muted',
    'overflow-x-auto',
  ].join(' '),
} as const;

/**
 * Showcase of all UI components and their variants.
 * Acts as living documentation for the design system.
 */
export const UIComponentsShowcase: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [togglePressed, setTogglePressed] = useState(false);
  const { success, error, warning, info, loading } = useToast();

  // Aztec Wallet hooks
  const { open: openConnectModal } = useConnectModal();
  const { open: openAccountModal } = useAccountModal();
  const { open: openNetworkModal } = useNetworkModal();

  return (
    <Card>
      <CardHeader className={styles.headerRow}>
        <Layers size={iconSize('xl')} className={styles.headerIcon} />
        <div>
          <CardTitle>UI Components</CardTitle>
          <CardDescription>
            Design system documentation - all available components and variants
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className={styles.sectionsContainer}>
        {/* ============ AZTEC WALLET UI ============ */}
        <section className={styles.walletSection}>
          <h2 className={styles.walletSectionTitle}>
            <Wallet size={iconSize('lg')} className={styles.headerIcon} />
            Aztec Wallet UI Components
          </h2>
          <p className={styles.sectionDescription}>
            Showcase of aztec-wallet library components. These are visual
            mockups - they don't reflect actual wallet state.
          </p>

          {/* ConnectButton States */}
          <h3 className={styles.walletSectionSubtitle}>ConnectButton States</h3>
          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>Disconnected (default)</span>
            <div className={styles.componentGrid}>
              <Button
                variant="primary"
                className={styles.connectButtonDisconnected}
                icon={
                  <Wallet size={iconSize()} className={styles.walletIcon} />
                }
              >
                Connect Wallet
              </Button>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>Custom label & icon</span>
            <div className={styles.componentGrid}>
              <Button
                variant="primary"
                className={styles.connectButtonDisconnected}
                icon={
                  <Rocket size={iconSize()} className={styles.walletIcon} />
                }
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                className={styles.connectButtonDisconnected}
              >
                Get Started
              </Button>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>
              Connecting (shimmer animation)
            </span>
            <div className={styles.componentGrid}>
              <Button
                variant="secondary"
                className={styles.connectButtonConnecting}
                disabled
              >
                <div className={styles.connectingContent}>
                  <div className={styles.spinner} />
                  <span>Connecting...</span>
                </div>
              </Button>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>
              Connected (with NetworkPicker full)
            </span>
            <div className={styles.componentGridWide}>
              <div className={styles.walletContainer}>
                {/* NetworkPicker Full */}
                <button type="button" className={styles.networkPickerFull}>
                  <div className={styles.networkIconContainer}>
                    <Globe size={iconSize()} className={styles.networkIcon} />
                  </div>
                  <span className={styles.networkName}>Devnet</span>
                  <ChevronDown
                    size={iconSize()}
                    className={styles.walletChevron}
                  />
                </button>
                {/* Connected Address */}
                <button type="button" className={styles.connectButtonConnected}>
                  <span className={styles.walletEmoji}>🦊</span>
                  <span className={styles.walletAddress}>0x1234...5678</span>
                  <ChevronDown
                    size={iconSize()}
                    className={styles.walletChevron}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>
              Connected (with NetworkPicker compact)
            </span>
            <div className={styles.componentGridWide}>
              <div className={styles.walletContainer}>
                {/* NetworkPicker Compact */}
                <button
                  type="button"
                  className={styles.networkPickerCompact}
                  title="Devnet"
                >
                  <div className={styles.networkIconContainer}>
                    <Globe
                      size={iconSize('md')}
                      className={styles.networkIcon}
                    />
                  </div>
                </button>
                {/* Connected Address */}
                <button type="button" className={styles.connectButtonConnected}>
                  <span className={styles.walletEmoji}>🐸</span>
                  <span className={styles.walletAddress}>0xabcd...ef12</span>
                  <ChevronDown
                    size={iconSize()}
                    className={styles.walletChevron}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>
              Connected (without NetworkPicker)
            </span>
            <div className={styles.componentGridWide}>
              {/* Just the Connected Address */}
              <button type="button" className={styles.connectButtonConnected}>
                <span className={styles.walletEmoji}>🦄</span>
                <span className={styles.walletAddress}>0x5678...9abc</span>
                <ChevronDown
                  size={iconSize()}
                  className={styles.walletChevron}
                />
              </button>
            </div>
          </div>

          {/* NetworkPicker Variants */}
          <h3 className={styles.walletSectionSubtitle}>
            NetworkPicker Variants
          </h3>
          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>
              Full variant (icon + name)
            </span>
            <div className={styles.componentGridWide}>
              <button type="button" className={styles.networkPickerFull}>
                <div className={styles.networkIconContainer}>
                  <Globe size={iconSize()} className={styles.networkIcon} />
                </div>
                <span className={styles.networkName}>Devnet</span>
                <ChevronDown
                  size={iconSize()}
                  className={styles.walletChevron}
                />
              </button>
              <button type="button" className={styles.networkPickerFull}>
                <div className={styles.networkIconContainer}>
                  <FlaskConical
                    size={iconSize()}
                    className={styles.networkIcon}
                  />
                </div>
                <span className={styles.networkName}>Sandbox</span>
                <ChevronDown
                  size={iconSize()}
                  className={styles.walletChevron}
                />
              </button>
              <button type="button" className={styles.networkPickerFull}>
                <div className={styles.networkIconContainer}>
                  <Box size={iconSize()} className={styles.networkIcon} />
                </div>
                <span className={styles.networkName}>Testnet</span>
                <ChevronDown
                  size={iconSize()}
                  className={styles.walletChevron}
                />
              </button>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>
              Compact variant (icon only)
            </span>
            <div className={styles.componentGridWide}>
              <button
                type="button"
                className={styles.networkPickerCompact}
                title="Devnet"
              >
                <div className={styles.networkIconContainer}>
                  <Globe size={iconSize('md')} className={styles.networkIcon} />
                </div>
              </button>
              <button
                type="button"
                className={styles.networkPickerCompact}
                title="Sandbox"
              >
                <div className={styles.networkIconContainer}>
                  <FlaskConical
                    size={iconSize('md')}
                    className={styles.networkIcon}
                  />
                </div>
              </button>
              <button
                type="button"
                className={styles.networkPickerCompact}
                title="Testnet"
              >
                <div className={styles.networkIconContainer}>
                  <Box size={iconSize('md')} className={styles.networkIcon} />
                </div>
              </button>
            </div>
          </div>

          {/* Connect Modal Preview */}
          <h3 className={styles.walletSectionSubtitle}>ConnectModal Preview</h3>
          <p className={styles.sectionDescription}>
            Modal that opens when clicking ConnectButton while disconnected.
          </p>
          <div className={styles.componentRow}>
            <div className={styles.modalPreview}>
              <h4 className={styles.modalPreviewTitle}>Connect Wallet</h4>
              <p className={styles.modalPreviewSubtitle}>
                Choose how you want to connect. Each option offers a different
                balance of convenience and security.
              </p>

              <div className={styles.componentColumn}>
                {/* Embedded Wallet Option */}
                <button type="button" className={styles.walletGroupButton}>
                  <div className={styles.walletGroupIconContainer}>
                    <Key size={iconSize('md')} />
                  </div>
                  <div className={styles.walletGroupContent}>
                    <span className={styles.walletGroupLabel}>
                      Embedded Wallet
                    </span>
                    <span className={styles.walletGroupDescription}>
                      Quick setup, no extension needed
                    </span>
                  </div>
                  <div className={styles.walletGroupRightSection}>
                    <Badge variant="primary">Beta</Badge>
                  </div>
                </button>

                {/* Aztec Wallet Option */}
                <button type="button" className={styles.walletGroupButton}>
                  <div className={styles.walletGroupIconContainer}>
                    <Wallet size={iconSize('md')} />
                  </div>
                  <div className={styles.walletGroupContent}>
                    <span className={styles.walletGroupLabel}>
                      Aztec Wallet
                    </span>
                    <span className={styles.walletGroupDescription}>
                      Azguard and other Aztec wallets
                    </span>
                  </div>
                  <div className={styles.walletGroupRightSection}>
                    <ChevronRight
                      size={iconSize('md')}
                      className={styles.walletGroupArrow}
                    />
                  </div>
                </button>

                {/* EVM Wallet Option */}
                <button type="button" className={styles.walletGroupButton}>
                  <div className={styles.walletGroupIconContainer}>
                    <CreditCard size={iconSize('md')} />
                  </div>
                  <div className={styles.walletGroupContent}>
                    <span className={styles.walletGroupLabel}>EVM Wallet</span>
                    <span className={styles.walletGroupDescription}>
                      MetaMask, Rabby, and more
                    </span>
                  </div>
                  <div className={styles.walletGroupRightSection}>
                    <ChevronRight
                      size={iconSize('md')}
                      className={styles.walletGroupArrow}
                    />
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Account Modal Preview */}
          <h3 className={styles.walletSectionSubtitle}>AccountModal Preview</h3>
          <p className={styles.sectionDescription}>
            Modal that opens when clicking the connected address.
          </p>
          <div className={styles.componentColumn}>
            {/* Default - without network */}
            <div className={styles.componentColumn}>
              <span className={styles.variantLabel}>
                Default (showNetwork: false)
              </span>
              <div className={styles.modalPreview}>
                <div className={styles.accountModalHeader}>
                  <div className={styles.accountEmojiContainer}>🦊</div>
                  <div className={styles.accountStatusBadge}>
                    <span className={styles.accountStatusDot} />
                    Connected
                  </div>
                </div>

                <div className={styles.componentColumn}>
                  <div className={styles.accountSection}>
                    <span className={styles.accountLabel}>Wallet Address</span>
                    <div className={styles.accountAddressContainer}>
                      <span className={styles.accountAddressText}>
                        0x1a2b3c4d...e5f6g7h8
                      </span>
                      <button
                        type="button"
                        className={styles.accountCopyButton}
                      >
                        <Copy size={iconSize()} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.accountSection}>
                    <button
                      type="button"
                      className={styles.accountDisconnectButton}
                    >
                      <LogOut size={iconSize()} />
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* With network section */}
            <div className={styles.componentColumn}>
              <span className={styles.variantLabel}>
                With network (showNetwork: true)
              </span>
              <div className={styles.modalPreview}>
                <div className={styles.accountModalHeader}>
                  <div className={styles.accountEmojiContainer}>🐸</div>
                  <div className={styles.accountStatusBadge}>
                    <span className={styles.accountStatusDot} />
                    Connected
                  </div>
                </div>

                <div className={styles.componentColumn}>
                  <div className={styles.accountSection}>
                    <span className={styles.accountLabel}>Wallet Address</span>
                    <div className={styles.accountAddressContainer}>
                      <span className={styles.accountAddressText}>
                        0xabcd1234...5678efgh
                      </span>
                      <button
                        type="button"
                        className={styles.accountCopyButton}
                      >
                        <Copy size={iconSize()} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.accountSection}>
                    <span className={styles.accountLabel}>Network</span>
                    <div className={styles.accountNetworkContainer}>
                      <div className={styles.accountNetworkInfo}>
                        <div className={styles.accountNetworkIconContainer}>
                          <Globe size={iconSize()} />
                        </div>
                        <span className={styles.accountNetworkName}>
                          Devnet
                        </span>
                      </div>
                      <span className={styles.accountNetworkBadge}>Active</span>
                    </div>
                  </div>

                  <div className={styles.accountSection}>
                    <button
                      type="button"
                      className={styles.accountDisconnectButton}
                    >
                      <LogOut size={iconSize()} />
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Network Modal Preview */}
          <h3 className={styles.walletSectionSubtitle}>NetworkModal Preview</h3>
          <p className={styles.sectionDescription}>
            Modal for selecting a different network.
          </p>
          <div className={styles.componentRow}>
            <div className={styles.modalPreview}>
              <h4 className={styles.modalPreviewTitle}>Switch Network</h4>
              <p className={styles.modalPreviewSubtitle}>
                Select the network you want to connect to.
              </p>

              <div className={styles.componentColumn}>
                <button
                  type="button"
                  className={`${styles.networkModalButton} ${styles.networkModalButtonActive}`}
                >
                  <div className={styles.networkModalIconContainer}>
                    <Globe
                      size={iconSize('md')}
                      className={styles.networkModalIconText}
                    />
                  </div>
                  <span className={styles.networkModalName}>Devnet</span>
                  <span className={styles.networkModalSpacer} />
                  <Check
                    size={iconSize()}
                    className={styles.networkModalCheck}
                  />
                </button>

                <button type="button" className={styles.networkModalButton}>
                  <div className={styles.networkModalIconContainer}>
                    <FlaskConical
                      size={iconSize('md')}
                      className={styles.networkModalIconText}
                    />
                  </div>
                  <span className={styles.networkModalName}>Sandbox</span>
                  <span className={styles.networkModalSpacer} />
                </button>

                <button type="button" className={styles.networkModalButton}>
                  <div className={styles.networkModalIconContainer}>
                    <Box
                      size={iconSize('md')}
                      className={styles.networkModalIconText}
                    />
                  </div>
                  <span className={styles.networkModalName}>Testnet</span>
                  <span className={styles.networkModalSpacer} />
                </button>
              </div>
            </div>
          </div>

          {/* Custom Button with Hooks */}
          <h3 className={styles.walletSectionSubtitle}>
            Using Hooks for Custom Buttons
          </h3>
          <p className={styles.sectionDescription}>
            Use hooks like useConnectModal, useAccountModal, and useNetworkModal
            to control modals from custom buttons.
          </p>
          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>
              Custom buttons that open modals (click to test!)
            </span>
            <div className={styles.componentGrid}>
              <Button
                variant="secondary"
                icon={<Wallet size={iconSize()} />}
                onClick={openConnectModal}
              >
                Open Connect Modal
              </Button>
              <Button
                variant="ghost"
                icon={<User size={iconSize()} />}
                onClick={openAccountModal}
              >
                View Account
              </Button>
              <Button
                variant="ghost"
                icon={<Globe size={iconSize()} />}
                onClick={openNetworkModal}
              >
                Switch Network
              </Button>
            </div>
            <pre className={styles.codeBlock}>
              {`const { open: openConnect } = useConnectModal();
const { open: openAccount } = useAccountModal();
const { open: openNetwork } = useNetworkModal();

<button onClick={openConnect}>Connect</button>`}
            </pre>
          </div>

          {/* Configuration Example */}
          <h3 className={styles.walletSectionSubtitle}>Configuration</h3>
          <p className={styles.sectionDescription}>
            Configure which wallet types and networks are available.
          </p>
          <pre className={styles.codeBlock}>
            {`const config = createAztecWalletConfig({
  networks: [
    { name: 'devnet', nodeUrl: 'https://devnet.aztec.network' },
    { name: 'sandbox', nodeUrl: 'http://localhost:8080' },
  ],
  walletGroups: {
    embedded: true,
    evmWallets: ['metamask', 'rabby'],
    aztecWallets: ['azguard'],
  },
  showNetworkPicker: 'full', // or 'compact'
});`}
          </pre>
        </section>

        {/* ============ BUTTONS ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Buttons</h3>
          <p className={styles.sectionDescription}>
            Button variants for different actions and contexts.
          </p>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>Variants</span>
            <div className={styles.componentGrid}>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="danger-outline">Danger Outline</Button>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>Sizes</span>
            <div className={styles.componentGrid}>
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>With Icons</span>
            <div className={styles.componentGrid}>
              <Button icon={<Rocket size={iconSize()} />}>Deploy</Button>
              <Button variant="secondary" icon={<Copy size={iconSize()} />}>
                Copy
              </Button>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>Icon Buttons</span>
            <div className={styles.componentGrid}>
              <Button variant="icon" size="icon">
                <Copy size={iconSize()} />
              </Button>
              <Button variant="icon" size="icon">
                <X size={iconSize()} />
              </Button>
              <Button variant="toggle" size="icon">
                <Sun size={iconSize()} />
              </Button>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>States</span>
            <div className={styles.componentGrid}>
              <Button isLoading>Loading</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>
        </section>

        {/* ============ INPUTS ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Inputs</h3>
          <p className={styles.sectionDescription}>
            Text input fields with labels, helpers, and error states.
          </p>

          <div className={styles.componentRow}>
            <Input
              label="Default Input"
              placeholder="Type something..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <Input
              label="With Helper"
              placeholder="Enter value"
              helperText="This is a helper text"
            />
            <Input
              label="With Error"
              placeholder="Invalid input"
              hasError
              error="This field is required"
            />
            <Input label="Disabled" placeholder="Can't edit" disabled />
          </div>
        </section>

        {/* ============ TEXTAREA ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Textarea</h3>
          <p className={styles.sectionDescription}>
            Multi-line text input for longer content.
          </p>

          <div className={styles.componentRow}>
            <Textarea
              label="Default Textarea"
              placeholder="Enter your message..."
              value={textareaValue}
              onChange={(e) => setTextareaValue(e.target.value)}
              rows={3}
            />
            <Textarea
              label="With Error"
              placeholder="Invalid content"
              hasError
              error="Content is too short"
              rows={3}
            />
          </div>
        </section>

        {/* ============ SELECT ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Select</h3>
          <p className={styles.sectionDescription}>
            Dropdown selection with Radix UI primitives.
          </p>

          <div className={styles.componentGrid}>
            <div className={styles.componentColumn}>
              <span className={styles.variantLabel}>Default</span>
              <Select value={selectValue} onValueChange={setSelectValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select option..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option1">Option 1</SelectItem>
                  <SelectItem value="option2">Option 2</SelectItem>
                  <SelectItem value="option3">Option 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={styles.componentColumn}>
              <span className={styles.variantLabel}>Disabled</span>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Disabled..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="x">X</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* ============ BADGES ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Badges</h3>
          <p className={styles.sectionDescription}>
            Status indicators and labels.
          </p>

          <div className={styles.componentGrid}>
            <Badge variant="default">Default</Badge>
            <Badge variant="primary">Primary</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="info">Info</Badge>
          </div>
        </section>

        {/* ============ ICONS ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Icons</h3>
          <p className={styles.sectionDescription}>
            All icons should be imported from{' '}
            <a
              href="https://lucide.dev/icons/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              Lucide React
              <ExternalLink size={iconSize()} />
            </a>
            . Use the iconSize() utility for consistent sizing: iconSize() for
            sm (16px default), iconSize('md') for md (20px).
          </p>

          <div className={styles.iconGrid}>
            {[
              { Icon: Home, name: 'Home' },
              { Icon: Settings, name: 'Settings' },
              { Icon: User, name: 'User' },
              { Icon: Search, name: 'Search' },
              { Icon: Heart, name: 'Heart' },
              { Icon: Star, name: 'Star' },
              { Icon: Mail, name: 'Mail' },
              { Icon: Calendar, name: 'Calendar' },
              { Icon: Camera, name: 'Camera' },
              { Icon: Download, name: 'Download' },
              { Icon: Upload, name: 'Upload' },
              { Icon: Trash2, name: 'Trash2' },
              { Icon: Edit, name: 'Edit' },
              { Icon: Copy, name: 'Copy' },
              { Icon: Check, name: 'Check' },
              { Icon: X, name: 'X' },
              { Icon: Info, name: 'Info' },
              { Icon: AlertTriangle, name: 'AlertTriangle' },
            ].map(({ Icon, name }) => (
              <div key={name} className={styles.iconItem}>
                <div className={styles.iconBox}>
                  <Icon size={iconSize('md')} />
                </div>
                <span className={styles.iconName}>{name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ============ TOGGLE ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Toggle</h3>
          <p className={styles.sectionDescription}>
            Radix UI toggle button with pressed state.
          </p>

          <div className={styles.componentGrid}>
            <div className={styles.componentColumn}>
              <span className={styles.variantLabel}>Default</span>
              <Toggle
                pressed={togglePressed}
                onPressedChange={setTogglePressed}
              >
                {togglePressed ? (
                  <Moon size={iconSize()} />
                ) : (
                  <Sun size={iconSize()} />
                )}
              </Toggle>
            </div>

            <div className={styles.componentColumn}>
              <span className={styles.variantLabel}>Ghost</span>
              <Toggle variant="ghost">
                <Bell size={iconSize()} />
              </Toggle>
            </div>
          </div>
        </section>

        {/* ============ TOOLTIP ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Tooltip</h3>
          <p className={styles.sectionDescription}>
            Hover to reveal additional information.
          </p>

          <div className={styles.componentGrid}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>This is a tooltip!</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="icon" size="icon">
                  <Info size={iconSize()} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Information tooltip</TooltipContent>
            </Tooltip>
          </div>
        </section>

        {/* ============ TABS ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Tabs</h3>
          <p className={styles.sectionDescription}>
            Radix UI tabs for content organization.
          </p>

          <Tabs defaultValue="tab1">
            <TabsList>
              <TabsTrigger value="tab1">Tab 1</TabsTrigger>
              <TabsTrigger value="tab2">Tab 2</TabsTrigger>
              <TabsTrigger value="tab3">Tab 3</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">
              <div className={styles.tabContent}>Content for Tab 1</div>
            </TabsContent>
            <TabsContent value="tab2">
              <div className={styles.tabContent}>Content for Tab 2</div>
            </TabsContent>
            <TabsContent value="tab3">
              <div className={styles.tabContent}>Content for Tab 3</div>
            </TabsContent>
          </Tabs>
        </section>

        {/* ============ DIALOG / MODAL ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Dialog / Modal</h3>
          <p className={styles.sectionDescription}>
            Radix UI dialog for modal content.
          </p>

          <div className={styles.componentGrid}>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dialog Title</DialogTitle>
                  <DialogDescription>
                    This is a dialog description. It provides context about the
                    dialog content.
                  </DialogDescription>
                </DialogHeader>
                <div className={styles.dialogBody}>
                  <p className={styles.dialogText}>
                    Dialog body content goes here. You can put any content
                    inside the dialog.
                  </p>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button>Confirm</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        {/* ============ TOASTS ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Toasts</h3>
          <p className={styles.sectionDescription}>
            Notification toasts with different variants.
          </p>

          <div className={styles.componentGrid}>
            <Button
              variant="secondary"
              onClick={() =>
                success('Success!', 'Operation completed successfully')
              }
              icon={<Check size={iconSize()} />}
            >
              Success Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => error('Error!', 'Something went wrong')}
              icon={<XCircle size={iconSize()} />}
            >
              Error Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => warning('Warning!', 'Please review this action')}
              icon={<AlertTriangle size={iconSize()} />}
            >
              Warning Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => info('Info', 'Here is some information')}
              icon={<Info size={iconSize()} />}
            >
              Info Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const toast = loading('Loading...', 'Please wait');
                setTimeout(
                  () => toast.success('Done!', 'Loading complete'),
                  2000
                );
              }}
            >
              Loading Toast
            </Button>
          </div>
        </section>

        {/* ============ CARDS ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Cards</h3>
          <p className={styles.sectionDescription}>
            Card containers with header, content, and footer sections.
          </p>

          <div className={styles.componentRow}>
            <Card className={styles.cardExample}>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>Card description text</CardDescription>
              </CardHeader>
              <CardContent>
                <p className={styles.cardText}>
                  This is the card content area where main information is
                  displayed.
                </p>
              </CardContent>
            </Card>

            <Card padding="sm" className={styles.cardExample}>
              <CardContent>
                <p className={styles.cardTextDefault}>
                  Compact card with small padding.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ============ DEVELOPMENT GUIDELINES ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Development Guidelines</h3>
          <p className={styles.sectionDescription}>
            Best practices for extending the component library.
          </p>

          <div className={styles.guidelineBox}>
            <div className={styles.guidelineTitle}>
              <BookOpen size={iconSize('md')} />
              Adding New Components
            </div>
            <p className={styles.guidelineText}>
              When you need a new UI component, always check{' '}
              <a
                href="https://www.radix-ui.com/primitives/docs/overview/introduction"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                Radix UI Primitives
                <ExternalLink size={iconSize()} />
              </a>{' '}
              first. If the component exists there, you must use it as the base.
            </p>
            <ul className={styles.guidelineList}>
              <li>Radix provides accessible, unstyled primitives</li>
              <li>Style with Tailwind using the semantic styles pattern</li>
              <li>Export from src/components/ui/index.ts</li>
              <li>Add examples to this showcase</li>
            </ul>
          </div>
        </section>
      </CardContent>
    </Card>
  );
};
