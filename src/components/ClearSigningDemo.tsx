/**
 * ClearSigningDemo - Full integration demo for EIP-712 clear signing with Aztec
 *
 * This component demonstrates:
 * 1. MetaMask connection with clear signing popup
 * 2. PXE (sandbox) connection
 * 3. EIP-712 account deployment
 * 4. Real transaction execution with capsules
 */

import React, { useState, useCallback } from 'react';
import type { Hex, WalletClient } from 'viem';
import { createWalletClient, custom, hashMessage, recoverPublicKey, keccak256, toBytes } from 'viem';
import { mainnet } from 'viem/chains';
import { EIP712_WITNESS_SLOT } from '../lib/eip712-clear-signing';
import { Eip712AuthWitnessProvider } from '../accounts/Eip712AuthWitnessProvider';
import { Eip712AccountContract } from '../accounts/Eip712AccountContract';
import { SharedPXEService, type SharedPXEInstance } from '../services/aztec/pxe';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { AccountManager } from '@aztec/aztec.js/wallet';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { TokenContract } from '../artifacts/Token';
import { DripperContract } from '../artifacts/Dripper';

type Step = 'connect-metamask' | 'connect-pxe' | 'deploy-account' | 'ready' | 'signing';

interface DemoState {
  step: Step;
  isLoading: boolean;
  error: string | null;
  // MetaMask state
  ethAddress: Hex | null;
  walletClient: WalletClient | null;
  chainId: bigint;
  publicKeyX: Buffer | null;
  publicKeyY: Buffer | null;
  secretKey: Fr | null;
  // PXE state
  pxeInstance: SharedPXEInstance | null;
  aztecWallet: Wallet | null;
  // Account state
  accountAddress: AztecAddress | null;
  accountDeployed: boolean;
  // Result state
  lastSignature: string | null;
  lastTxHash: string | null;
}

const initialState: DemoState = {
  step: 'connect-metamask',
  isLoading: false,
  error: null,
  ethAddress: null,
  walletClient: null,
  chainId: 31337n,
  publicKeyX: null,
  publicKeyY: null,
  secretKey: null,
  pxeInstance: null,
  aztecWallet: null,
  accountAddress: null,
  accountDeployed: false,
  lastSignature: null,
  lastTxHash: null,
};

// Sandbox deployed token contracts
const SANDBOX_TOKENS = {
  WETH: '0x1d64b9cf07d536e6b218c14256c4965abb568f02648d5ce1da6d58caea6c3639',
  DAI: '0x1a655419f55936b914c302f5bd83fc22e564cb135e8ecb07342b24f13c7b939f',
  USDC: '0x212028585111d48bdb2b447c070d44acd5c5c10dc6973879f7a128d631f4dcb4',
};

const DRIPPER_ADDRESS = '0x02bc708c7f88a6bacefb7133eaf97a55d28980717c72bbd63d36d516536d9c21';

export const ClearSigningDemo: React.FC = () => {
  const [state, setState] = useState<DemoState>(initialState);
  const [targetAddress, setTargetAddress] = useState<string>(SANDBOX_TOKENS.WETH);
  const [functionSignature] = useState<string>(
    'transfer_public_to_public(Field,Field,u128,Field)'
  );
  const [selectedToken, setSelectedToken] = useState<string>('WETH');
  const [transferAmount, setTransferAmount] = useState<string>('100');
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-50), `[${timestamp}] ${msg}`]);
  }, []);

  // Step 1: Connect MetaMask and derive public key
  const connectMetaMask = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    addLog('Connecting to MetaMask...');

    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask not found. Please install MetaMask extension.');
      }

      // Request accounts
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const ethAddress = accounts[0] as Hex;
      addLog(`MetaMask connected: ${ethAddress.slice(0, 10)}...`);

      // Get chain ID
      const currentChainId = await window.ethereum.request({
        method: 'eth_chainId',
      });
      const chainId = BigInt(currentChainId as string);
      addLog(`Chain ID: ${chainId}`);

      // Create wallet client
      const walletClient = createWalletClient({
        chain: mainnet,
        transport: custom(window.ethereum),
      });

      // Derive public key by signing a message
      addLog('Deriving public key (please sign the message in MetaMask)...');
      const signature = await walletClient.signMessage({
        account: ethAddress,
        message: 'Derive Aztec public key',
      });

      const msgHash = hashMessage('Derive Aztec public key');
      const publicKey = await recoverPublicKey({
        hash: msgHash,
        signature,
      });

      // publicKey is 0x04 + x (32 bytes) + y (32 bytes)
      const pubKeyHex = publicKey.slice(4);
      const publicKeyX = Buffer.from(pubKeyHex.slice(0, 64), 'hex');
      const publicKeyY = Buffer.from(pubKeyHex.slice(64), 'hex');
      addLog(`Public key derived: x=${publicKeyX.toString('hex').slice(0, 16)}...`);

      // Derive a secret key from the signature (deterministic per address)
      const secretKeyHash = keccak256(toBytes(signature));
      const secretKey = Fr.fromHexString(secretKeyHash);
      addLog(`Secret key derived from signature`);

      setState((s) => ({
        ...s,
        ethAddress,
        walletClient,
        chainId,
        publicKeyX,
        publicKeyY,
        secretKey,
        step: 'connect-pxe',
        isLoading: false,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      addLog(`Error: ${msg}`);
      setState((s) => ({ ...s, error: msg, isLoading: false }));
    }
  }, [addLog]);

  // Step 2: Connect to PXE (sandbox)
  const connectPXE = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    addLog('Connecting to PXE (sandbox)...');

    try {
      // Default sandbox URL
      const nodeUrl = 'http://localhost:8080';
      const pxeInstance = await SharedPXEService.getInstance(nodeUrl, 'sandbox');
      addLog('PXE connected successfully!');

      // Get node info
      const nodeInfo = await pxeInstance.aztecNode.getNodeInfo();
      addLog(`Node version: ${nodeInfo.nodeVersion}`);

      // Get the wallet from the PXE instance
      const aztecWallet = pxeInstance.wallet;
      addLog(`Aztec wallet ready`);

      setState((s) => ({
        ...s,
        pxeInstance,
        aztecWallet,
        step: 'deploy-account',
        isLoading: false,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to PXE';
      addLog(`Error: ${msg}`);
      setState((s) => ({ ...s, error: msg, isLoading: false }));
    }
  }, [addLog]);

  // Step 3: Deploy or reuse EIP-712 account contract
  const deployAccount = useCallback(async () => {
    const { pxeInstance, aztecWallet, walletClient, ethAddress, publicKeyX, publicKeyY, secretKey, chainId } =
      state;
    if (!pxeInstance || !aztecWallet || !walletClient || !ethAddress || !publicKeyX || !publicKeyY || !secretKey) {
      setState((s) => ({ ...s, error: 'Missing required state' }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));
    addLog('Setting up EIP-712 account...');

    try {
      // Create the account contract instance
      const accountContract = new Eip712AccountContract(
        publicKeyX,
        publicKeyY,
        walletClient,
        ethAddress,
        chainId
      );

      // Use deterministic salt derived from ETH address for consistent account address
      const saltHash = keccak256(toBytes(ethAddress));
      const salt = Fr.fromHexString(saltHash);
      addLog(`Using deterministic salt from ETH address`);

      const accountManager = await AccountManager.create(aztecWallet, secretKey, accountContract, salt);

      // Pre-computed address (deterministic based on ETH address)
      const preComputedAddress = accountManager.address;
      addLog(`Account address: ${preComputedAddress.toString().slice(0, 20)}...`);

      // Register the contract class and instance with PXE
      addLog('Registering contract with PXE...');
      const instance = accountManager.getInstance();
      const artifact = await accountContract.getContractArtifact();

      // Register the contract class (artifact) first
      await pxeInstance.pxe.registerContractClass(artifact);
      addLog('Contract class registered');

      // Register the instance directly with PXE (object format)
      await pxeInstance.pxe.registerContract({ instance, artifact });
      addLog('Contract instance registered');

      // Also register with wallet for account lookups
      await aztecWallet.registerContract(instance, artifact, accountManager.getSecretKey());
      addLog('Contract registered with wallet');

      // Add the account to the wallet BEFORE deployment (required for auth witness creation)
      const account = await accountManager.getAccount();
      aztecWallet.addAccount(account);
      addLog('Account added to wallet');

      // Try to deploy the account (will fail if already deployed)
      addLog('Attempting to deploy account...');
      try {
        // Get sponsored fee payment method
        const feePaymentMethod = await pxeInstance.getSponsoredFeePaymentMethod();

        // Get the deploy method
        const deployMethod = await accountManager.getDeployMethod();

        // Send the deployment transaction with sponsored fees
        addLog('Sending deployment transaction (sponsored fees)...');
        const sentTx = deployMethod.send({
          from: AztecAddress.ZERO,
          fee: { paymentMethod: feePaymentMethod },
          skipClassPublication: true,
          skipInstancePublication: true,
        });

        // Wait for deployment
        addLog('Waiting for transaction confirmation...');
        const receipt = await sentTx.wait({ timeout: 120000 });
        addLog(`Account deployed! Block: ${receipt.blockNumber}`);
      } catch (deployErr) {
        const deployErrMsg = deployErr instanceof Error ? deployErr.message : String(deployErr);
        // "Existing nullifier" means account is already deployed - that's fine!
        if (deployErrMsg.includes('Existing nullifier') || deployErrMsg.includes('already deployed')) {
          addLog('Account already deployed! Reusing existing account.');
        } else {
          // Re-throw other errors
          throw deployErr;
        }
      }

      // Drip tokens to the account so we have something to transfer
      addLog('Dripping tokens to account...');
      try {
        const dripperAddress = AztecAddress.fromString(DRIPPER_ADDRESS);
        const tokenToDrip = AztecAddress.fromString(SANDBOX_TOKENS.WETH);

        // Register Dripper contract
        await pxeInstance.pxe.registerContractClass(DripperContract.artifact);

        // Fetch dripper instance from node and register
        const dripperInstance = await pxeInstance.aztecNode.getContract(dripperAddress);
        if (dripperInstance) {
          await pxeInstance.pxe.registerContract({
            instance: dripperInstance,
            artifact: DripperContract.artifact,
          });
        }

        const dripper = await DripperContract.at(dripperAddress, aztecWallet);
        const feePaymentMethod = await pxeInstance.getSponsoredFeePaymentMethod();

        // Drip 1000 tokens (adjust amount as needed)
        const dripAmount = 1000n * 10n ** 18n; // 1000 tokens with 18 decimals
        addLog(`Dripping ${dripAmount} WETH to account...`);

        const dripTx = dripper.methods.drip_to_public(tokenToDrip, dripAmount).send({
          from: preComputedAddress,
          fee: { paymentMethod: feePaymentMethod },
        });

        await dripTx.wait({ timeout: 120000 });
        addLog('Tokens dripped successfully!');
      } catch (dripErr) {
        const dripErrMsg = dripErr instanceof Error ? dripErr.message : String(dripErr);
        // Don't fail if drip fails - user might already have tokens
        addLog(`Note: Drip failed (${dripErrMsg.slice(0, 50)}...) - continuing anyway`);
        console.warn('Drip error (non-fatal):', dripErr);
      }

      setState((s) => ({
        ...s,
        accountAddress: preComputedAddress,
        accountDeployed: true,
        step: 'ready',
        isLoading: false,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to deploy account';
      addLog(`Error: ${msg}`);
      console.error('Deployment error:', err);
      setState((s) => ({ ...s, error: msg, isLoading: false }));
    }
  }, [state, addLog]);

  // Step 4: Sign and send transaction with clear signing
  const signAndSend = useCallback(async () => {
    const {
      walletClient,
      ethAddress,
      chainId,
      pxeInstance,
      aztecWallet,
      accountAddress,
    } = state;

    if (!walletClient || !ethAddress || !pxeInstance || !aztecWallet || !accountAddress) {
      setState((s) => ({ ...s, error: 'Not fully initialized' }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null, step: 'signing' }));

    try {
      // Validate target address
      if (!targetAddress) {
        throw new Error('No token selected. Please select a token.');
      }

      // Parse transfer parameters
      const tokenAddress = AztecAddress.fromString(targetAddress);
      const recipient = recipientAddress && recipientAddress.trim()
        ? AztecAddress.fromString(recipientAddress)
        : accountAddress; // Default to self-transfer for testing
      const amount = BigInt(transferAmount || '0');

      addLog(`Token: ${selectedToken} (${targetAddress.slice(0, 16)}...)`);
      addLog(`Recipient: ${recipient.toString().slice(0, 16)}...`);
      addLog(`Amount: ${amount}`);

      // Ensure EIP712 account artifact is registered (needed for entrypoint simulation)
      addLog('Ensuring EIP712 account artifact is registered...');
      const { Eip712AccountContractArtifact } = await import('../artifacts/Eip712Account');
      await pxeInstance.pxe.registerContractClass(Eip712AccountContractArtifact);

      // Fetch and register token contract instance from the node
      addLog('Fetching token contract instance from node...');
      const tokenInstance = await pxeInstance.aztecNode.getContract(tokenAddress);
      console.log('Token instance from node:', tokenInstance);
      if (!tokenInstance) {
        throw new Error(`Token contract instance not found at ${targetAddress}. Make sure sandbox is running with pre-deployed tokens.`);
      }
      addLog(`Token instance found!`);

      // Register the token contract class (artifact) with PXE
      addLog('Registering token contract class...');
      await pxeInstance.pxe.registerContractClass(TokenContract.artifact);

      // Register the token contract instance with PXE (links address to artifact)
      addLog('Registering token contract instance with PXE...');
      await pxeInstance.pxe.registerContract({
        instance: tokenInstance,
        artifact: TokenContract.artifact,
      });
      addLog('Token contract registered successfully!');

      // Create Token contract wrapper
      const token = await TokenContract.at(tokenAddress, aztecWallet);

      // Build the transfer call
      // transfer_public_to_public(from, to, amount, nonce)
      // For authwit, nonce is typically 0 when called directly
      addLog('Building transfer_public_to_public transaction...');
      const transferCall = token.methods.transfer_public_to_public(
        accountAddress,  // from
        recipient,       // to
        amount,          // amount
        Fr.ZERO          // nonce
      );

      // Get the function call details for EIP-712 signing
      const txNonce = BigInt(Date.now());

      // Create auth witness provider
      const provider = new Eip712AuthWitnessProvider(walletClient, ethAddress, chainId);

      addLog('Building EIP-712 typed data...');
      addLog('Requesting signature from MetaMask (check popup)...');
      addLog(`Function: ${functionSignature}`);

      // Get signature and capsule data
      const authResult = await provider.createAuthWitForEntrypoint({
        targetAddress: tokenAddress.toString() as Hex,
        functionSignature,
        args: [
          BigInt(accountAddress.toString()),
          BigInt(recipient.toString()),
          amount,
          0n, // nonce
        ],
        txNonce,
      });

      const sigHex = `0x${Buffer.from(authResult.signature.r).toString('hex')}${Buffer.from(authResult.signature.s).toString('hex')}`;
      addLog('Signature received!');
      addLog(`Signature r: 0x${Buffer.from(authResult.signature.r).toString('hex').slice(0, 16)}...`);
      addLog(`Capsule fields: ${authResult.capsuleFields.length}`);

      // Set signature immediately (for E2E test compatibility)
      setState((s) => ({
        ...s,
        lastSignature: sigHex,
      }));

      // Create capsule
      const { Capsule } = await import('@aztec/stdlib/tx');
      const capsuleData = authResult.capsuleFields.map((f) =>
        f instanceof Fr ? f : new Fr(f)
      );
      const capsule = new Capsule(
        accountAddress,
        new Fr(EIP712_WITNESS_SLOT),
        capsuleData
      );
      addLog('Capsule created successfully!');

      // Get sponsored fee payment method
      addLog('Getting sponsored fee payment method...');
      const feePaymentMethod = await pxeInstance.getSponsoredFeePaymentMethod();

      // Execute the transaction with the capsule
      addLog('Sending transaction with capsule...');
      const sentTx = transferCall.send({
        from: accountAddress,
        fee: { paymentMethod: feePaymentMethod },
        capsules: [capsule],
      });

      addLog('Waiting for transaction confirmation...');
      const receipt = await sentTx.wait({ timeout: 120000 });

      const txHash = receipt.txHash.toString();
      addLog(`Transaction confirmed! Block: ${receipt.blockNumber}`);
      addLog(`Tx Hash: ${txHash.slice(0, 20)}...`);

      setState((s) => ({
        ...s,
        lastTxHash: txHash,
        step: 'ready',
        isLoading: false,
      }));

      addLog('Clear signing transfer complete!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      addLog(`Error: ${msg}`);
      console.error('Transaction error:', err);
      setState((s) => ({ ...s, error: msg, step: 'ready', isLoading: false }));
    }
  }, [state, targetAddress, recipientAddress, transferAmount, selectedToken, functionSignature, addLog]);

  // Reset state
  const reset = useCallback(() => {
    setState(initialState);
    setLogs([]);
    addLog('Demo reset');
  }, [addLog]);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>EIP-712 Clear Signing Integration</h2>
      <p style={styles.description}>
        Full integration demo: MetaMask + Aztec Sandbox with human-readable signing.
      </p>

      {/* Progress Steps */}
      <div style={styles.steps} data-testid="step-indicator" data-step={state.step}>
        <StepIndicator
          number={1}
          label="MetaMask"
          active={state.step === 'connect-metamask'}
          completed={state.ethAddress !== null}
        />
        <StepIndicator
          number={2}
          label="PXE"
          active={state.step === 'connect-pxe'}
          completed={state.pxeInstance !== null}
        />
        <StepIndicator
          number={3}
          label="Deploy"
          active={state.step === 'deploy-account'}
          completed={state.accountDeployed}
        />
        <StepIndicator
          number={4}
          label="Sign"
          active={state.step === 'signing' || state.step === 'ready'}
          completed={state.lastSignature !== null}
        />
      </div>

      {/* Indicators for E2E tests */}
      {state.ethAddress && <span data-testid="metamask-connected" style={{ display: 'none' }} />}
      {state.publicKeyX && <span data-testid="public-key-derived" style={{ display: 'none' }} />}
      {state.pxeInstance && <span data-testid="pxe-connected" style={{ display: 'none' }} />}
      {state.accountDeployed && <span data-testid="account-deployed" style={{ display: 'none' }} />}
      {state.lastSignature && <span data-testid="tx-signed" style={{ display: 'none' }} />}

      {/* Error Display */}
      {state.error && <div style={styles.error} data-testid="error-message"><strong>Error:</strong> {state.error}</div>}

      {/* Step 1: MetaMask */}
      {state.step === 'connect-metamask' && (
        <div style={styles.section}>
          <h3>Step 1: Connect MetaMask</h3>
          <p>Connect your MetaMask wallet and derive your public key.</p>
          <button
            onClick={connectMetaMask}
            disabled={state.isLoading}
            style={styles.buttonPrimary}
            data-testid="connect-metamask"
          >
            {state.isLoading ? 'Connecting...' : 'Connect MetaMask'}
          </button>
        </div>
      )}

      {/* Step 2: PXE */}
      {state.step === 'connect-pxe' && (
        <div style={styles.section}>
          <h3>Step 2: Connect to Sandbox</h3>
          <p>Connect to the local Aztec sandbox (make sure it's running on port 8080).</p>
          <p style={styles.info}>
            MetaMask: <code>{state.ethAddress?.slice(0, 10)}...</code>
          </p>
          <button
            onClick={connectPXE}
            disabled={state.isLoading}
            style={styles.buttonPrimary}
            data-testid="connect-pxe"
          >
            {state.isLoading ? 'Connecting...' : 'Connect to Sandbox'}
          </button>
        </div>
      )}

      {/* Step 3: Deploy */}
      {state.step === 'deploy-account' && (
        <div style={styles.section}>
          <h3>Step 3: Deploy EIP-712 Account</h3>
          <p>Deploy your EIP-712 enabled account contract.</p>
          <button
            onClick={deployAccount}
            disabled={state.isLoading}
            style={styles.buttonPrimary}
            data-testid="deploy-account"
          >
            {state.isLoading ? 'Deploying...' : 'Deploy Account'}
          </button>
        </div>
      )}

      {/* Step 4: Sign */}
      {(state.step === 'ready' || state.step === 'signing') && (
        <div style={styles.section}>
          <h3>Step 4: Transfer Tokens with Clear Signing</h3>
          <p>Transfer tokens using human-readable EIP-712 signing. MetaMask will show the transfer details!</p>

          <div style={styles.form}>
            <label style={styles.label}>
              Token:
              <select
                value={selectedToken}
                onChange={(e) => {
                  setSelectedToken(e.target.value);
                  setTargetAddress(SANDBOX_TOKENS[e.target.value as keyof typeof SANDBOX_TOKENS]);
                }}
                style={styles.input}
              >
                <option value="WETH">WETH (18 decimals)</option>
                <option value="DAI">DAI (9 decimals)</option>
                <option value="USDC">USDC (6 decimals)</option>
              </select>
            </label>

            <label style={styles.label}>
              Recipient Address:
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                style={styles.input}
                placeholder={state.accountAddress?.toString() || '0x...'}
              />
              <small style={{ color: '#666' }}>Leave empty to transfer to self (for testing)</small>
            </label>

            <label style={styles.label}>
              Amount:
              <input
                type="text"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                style={styles.input}
                placeholder="100"
              />
            </label>
          </div>

          <div style={styles.buttonRow}>
            <button
              onClick={signAndSend}
              disabled={state.isLoading}
              style={styles.buttonPrimary}
              data-testid="sign-tx"
            >
              {state.isLoading ? 'Signing & Sending...' : 'Transfer with Clear Signing'}
            </button>
            <button onClick={reset} style={styles.buttonSecondary} data-testid="reset">
              Reset
            </button>
          </div>

          {state.lastSignature && (
            <div style={styles.result}>
              <p><strong>Last Signature:</strong></p>
              <pre style={styles.code}>{state.lastSignature}</pre>
            </div>
          )}

          {state.lastTxHash && (
            <div style={{ ...styles.result, backgroundColor: '#d1fae5' }}>
              <p><strong>Transaction Executed!</strong></p>
              <pre style={styles.code}>{state.lastTxHash}</pre>
            </div>
          )}
        </div>
      )}

      {/* Status Info */}
      {state.accountAddress && (
        <div style={styles.statusBox}>
          <p><strong>Account Address:</strong> <code>{state.accountAddress.toString().slice(0, 20)}...</code></p>
          <p><strong>Chain ID:</strong> <code>{state.chainId.toString()}</code></p>
        </div>
      )}

      {/* Logs */}
      <div style={styles.section}>
        <h3>Logs</h3>
        <div style={styles.logBox} data-testid="log-output">
          {logs.length === 0 ? (
            <p style={styles.logEmpty}>No logs yet...</p>
          ) : (
            logs.map((log, i) => (
              <p key={i} style={styles.logLine}>{log}</p>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Step indicator component
const StepIndicator: React.FC<{
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}> = ({ number, label, active, completed }) => (
  <div style={{
    ...styles.step,
    backgroundColor: completed ? '#10b981' : active ? '#3b82f6' : '#e5e5e5',
    color: completed || active ? 'white' : '#666',
  }}>
    <span style={styles.stepNumber}>{completed ? '✓' : number}</span>
    <span style={styles.stepLabel}>{label}</span>
  </div>
);

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  title: {
    fontSize: '24px',
    marginBottom: '8px',
  },
  description: {
    color: '#666',
    marginBottom: '24px',
  },
  steps: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
  },
  step: {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  stepNumber: {
    fontSize: '18px',
    fontWeight: 'bold',
  },
  stepLabel: {
    fontSize: '12px',
  },
  section: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
  },
  form: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '12px',
    fontSize: '14px',
    fontWeight: '500',
  },
  input: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    marginTop: '4px',
    boxSizing: 'border-box' as const,
  },
  buttonPrimary: {
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginRight: '8px',
  },
  buttonSecondary: {
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: '#e5e5e5',
    color: '#333',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  buttonRow: {
    display: 'flex',
    gap: '8px',
  },
  error: {
    padding: '12px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  info: {
    color: '#666',
    marginBottom: '12px',
  },
  result: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: 'white',
    borderRadius: '4px',
    border: '1px solid #ddd',
  },
  code: {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    padding: '12px',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: '12px',
    wordBreak: 'break-all' as const,
  },
  statusBox: {
    padding: '12px',
    backgroundColor: '#d1fae5',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  logBox: {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    padding: '12px',
    borderRadius: '4px',
    maxHeight: '200px',
    overflow: 'auto',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  logEmpty: {
    color: '#888',
    margin: 0,
  },
  logLine: {
    margin: '2px 0',
  },
};

// Extend Window type for ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      isMetaMask?: boolean;
    };
  }
}

export default ClearSigningDemo;
