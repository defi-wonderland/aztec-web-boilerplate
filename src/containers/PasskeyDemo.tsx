import { useState, useCallback } from 'react';
import {
  Fingerprint,
  Unplug,
  Loader2,
  CheckCircle,
  Coins,
  RefreshCw,
} from 'lucide-react';
import { PasskeyWalletProvider, usePasskeyWallet } from '@aztec/passkey-wallet';
import type { PasskeyWalletConfig } from '@aztec/passkey-wallet';
import { TokenContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Token.js';
import { DripperContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Dripper.js';
import { Contract } from '@aztec/aztec.js/contracts';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import type { Wallet } from '@aztec/aztec.js';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from '../components/ui';
import { iconSize } from '../utils';

// Sandbox deployment addresses
const SANDBOX_TOKEN_ADDRESS =
  '0x15a9fec4a47541e2717c007e046837208e9383a9b66ca5bda8dfe63f785f4c47';
const SANDBOX_DRIPPER_ADDRESS =
  '0x14fc6329654486ae793a6ba5b4ac0479fd09902e98f928bfd0ef05d103ea402a';

const config: PasskeyWalletConfig = {
  network: 'sandbox',
  nodeUrl: 'http://localhost:8080',
  rpId: 'localhost',
  walletHost: 'http://localhost:3001',
  contracts: [],
};

const styles = {
  card: 'w-full',
  header: 'flex flex-col gap-1',
  headerRow: 'flex items-center gap-3',
  headerIcon: 'text-accent',
  statusSection: 'flex flex-col gap-4',
  statusRow: 'flex items-center justify-between',
  statusLabel: 'text-sm font-medium text-muted',
  addressCard: 'bg-surface-secondary rounded-lg px-4 py-3',
  addressLabel: 'text-xs text-muted mb-1',
  addressValue: 'font-mono text-sm text-default break-all',
  actions: 'flex flex-col gap-3 pt-2',
  divider: 'border-t border-default my-2',
  balanceSection: 'flex flex-col gap-3',
  balanceRow: 'flex items-center justify-between',
  balanceLabel: 'text-sm text-muted',
  balanceValue: 'text-lg font-semibold text-default font-mono',
  mintSection: 'flex flex-col gap-3 pt-2',
  mintLabel: 'text-sm font-medium text-default',
  resultMessage: 'text-xs text-muted mt-1',
  errorMessage: 'text-xs text-red-500 mt-1',
} as const;

function WalletDashboard() {
  const { isConnected, isConnecting, address, wallet, connect, disconnect } =
    usePasskeyWallet();
  const [publicBalance, setPublicBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!wallet || !address) return;
    setIsLoadingBalance(true);
    setError(null);
    try {
      // Step 1: Verify Wallet proxy works
      const accounts = await wallet.getAccounts();
      console.log('[PasskeyDemo] Accounts:', accounts.length);
      setPublicBalance(`${accounts.length} account(s) connected`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed: ${msg}`);
      console.error('[PasskeyDemo] Error:', err);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [wallet, address, publicBalance]);

  const mintPublic = useCallback(async () => {
    if (!wallet || !address) return;
    setIsMinting(true);
    setError(null);
    setLastResult(null);
    try {
      const tokenAddress = AztecAddress.fromString(SANDBOX_TOKEN_ADDRESS);
      const dripperAddress = AztecAddress.fromString(SANDBOX_DRIPPER_ADDRESS);
      const dripper = Contract.at(
        dripperAddress,
        DripperContract.artifact,
        wallet as Wallet,
      );
      // drip_to_private is a private function
      const result = await dripper.methods
        .drip_to_private(tokenAddress, 1n)
        .send()
        .wait();
      setLastResult(
        `Minted! Tx: ${result.txHash?.toString().substring(0, 20)}...`,
      );
      await fetchBalance();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Mint failed: ${msg}`);
      console.error('Mint error:', err);
    } finally {
      setIsMinting(false);
    }
  }, [wallet, address, fetchBalance]);

  return (
    <Card className={styles.card} data-testid="passkey-wallet-card">
      <CardHeader>
        <div className={styles.headerRow}>
          <Fingerprint size={iconSize('lg')} className={styles.headerIcon} />
          <div className={styles.header}>
            <CardTitle>Passkey Wallet</CardTitle>
            <CardDescription>
              Authenticate with Face ID, Touch ID, or fingerprint
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className={styles.statusSection}>
          {/* Status */}
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>Status</span>
            {isConnecting && (
              <Badge variant="warning" data-testid="passkey-status-connecting">
                <Loader2
                  size={iconSize('xs')}
                  className="animate-spin mr-1"
                />
                Connecting
              </Badge>
            )}
            {isConnected && (
              <Badge variant="success" data-testid="passkey-status-connected">
                <CheckCircle size={iconSize('xs')} className="mr-1" />
                Connected
              </Badge>
            )}
            {!isConnected && !isConnecting && (
              <Badge
                variant="default"
                data-testid="passkey-status-disconnected"
              >
                Disconnected
              </Badge>
            )}
          </div>

          {/* Address */}
          {address && (
            <div
              className={styles.addressCard}
              data-testid="passkey-address-card"
            >
              <div className={styles.addressLabel}>Wallet Address</div>
              <div
                className={styles.addressValue}
                data-testid="passkey-address-value"
              >
                {address}
              </div>
            </div>
          )}

          {/* Connect / Disconnect */}
          <div className={styles.actions}>
            {!isConnected ? (
              <Button
                variant="primary"
                onClick={connect}
                disabled={isConnecting}
                isLoading={isConnecting}
                icon={
                  !isConnecting ? (
                    <Fingerprint size={iconSize()} />
                  ) : undefined
                }
                data-testid="passkey-connect-button"
              >
                {isConnecting ? 'Connecting...' : 'Connect with Passkey'}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={disconnect}
                icon={<Unplug size={iconSize()} />}
                data-testid="passkey-disconnect-button"
              >
                Disconnect
              </Button>
            )}
          </div>

          {/* Balance + Mint (shown when connected) */}
          {isConnected && (
            <>
              <div className={styles.divider} />

              <div className={styles.balanceSection}>
                <div className={styles.balanceRow}>
                  <span className={styles.balanceLabel}>Public Balance</span>
                  <span
                    className={styles.balanceValue}
                    data-testid="passkey-balance-value"
                  >
                    {isLoadingBalance
                      ? '...'
                      : publicBalance !== null
                        ? `${publicBalance} TST`
                        : '—'}
                  </span>
                </div>

                <Button
                  variant="secondary"
                  onClick={fetchBalance}
                  disabled={isLoadingBalance}
                  isLoading={isLoadingBalance}
                  icon={<RefreshCw size={iconSize()} />}
                  data-testid="passkey-fetch-balance"
                >
                  {isLoadingBalance ? 'Fetching...' : 'Fetch Balance'}
                </Button>
              </div>

              <div className={styles.mintSection}>
                <span className={styles.mintLabel}>Mint Tokens</span>
                <Button
                  variant="primary"
                  onClick={mintPublic}
                  disabled={isMinting}
                  isLoading={isMinting}
                  icon={<Coins size={iconSize()} />}
                  data-testid="passkey-mint-button"
                >
                  {isMinting ? 'Minting...' : 'Mint 1 TST (Private)'}
                </Button>
                {lastResult && (
                  <p className={styles.resultMessage}>{lastResult}</p>
                )}
              </div>

              {error && <p className={styles.errorMessage}>{error}</p>}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PasskeyDemo() {
  return (
    <PasskeyWalletProvider config={config}>
      <WalletDashboard />
    </PasskeyWalletProvider>
  );
}
