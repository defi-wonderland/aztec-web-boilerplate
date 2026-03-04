import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import type {
  ResolvedAztecWalletConfig,
  ModalView,
  ModalWalletType,
} from '../../types';

interface ConnectingState {
  walletId: string;
  walletName: string;
  walletType: ModalWalletType;
}

interface SuccessState {
  address: string;
}

interface ConnectModalContextValue {
  // Config
  config: ResolvedAztecWalletConfig;

  // View navigation
  view: ModalView;
  setView: (view: ModalView) => void;
  goBack: () => void;

  // Connecting state
  connectingState: ConnectingState | null;
  setConnectingState: (state: ConnectingState | null) => void;

  // Success state
  successState: SuccessState | null;
  setSuccessState: (state: SuccessState | null) => void;

  // Error state
  error: string | null;
  setError: (error: string | null) => void;

  // Loading state (prevents duplicate calls)
  isLoading: boolean;

  // Actions
  onClose: () => void;
  onConnect: (walletId: string, walletType: ModalWalletType) => Promise<void>;
  reset: () => void;
}

const ConnectModalContext = createContext<ConnectModalContextValue | null>(
  null
);

export interface ConnectModalProviderProps {
  config: ResolvedAztecWalletConfig;
  onClose: () => void;
  onConnect: (walletId: string, walletType: ModalWalletType) => Promise<void>;
  children: React.ReactNode;
}

export const ConnectModalProvider: React.FC<ConnectModalProviderProps> = ({
  config,
  onClose,
  onConnect,
  children,
}) => {
  const [view, setView] = useState<ModalView>('main');
  const [connectingState, setConnectingState] =
    useState<ConnectingState | null>(null);
  const [successState, setSuccessState] = useState<SuccessState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const connectingRef = useRef(false);

  const reset = useCallback(() => {
    setView('main');
    setConnectingState(null);
    setSuccessState(null);
    setError(null);
    setIsLoading(false);
    connectingRef.current = false;
  }, []);

  const goBack = useCallback(() => {
    setView('main');
    setError(null);
    setConnectingState(null);
    setIsLoading(false);
    connectingRef.current = false;
  }, []);

  const handleConnect = useCallback(
    async (walletId: string, walletType: ModalWalletType) => {
      // Prevent duplicate connection attempts
      if (connectingRef.current || isLoading) {
        console.warn('Modal: Connection already in progress');
        return;
      }

      connectingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        await onConnect(walletId, walletType);
        // Connection successful - the parent will close the modal
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Connection failed';
        console.error('Modal: Connection error:', errorMessage);
        setError(errorMessage);
        setView('main');
        setConnectingState(null);
      } finally {
        setIsLoading(false);
        connectingRef.current = false;
      }
    },
    [onConnect, isLoading]
  );

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const value = useMemo(
    () => ({
      config,
      view,
      setView,
      goBack,
      connectingState,
      setConnectingState,
      successState,
      setSuccessState,
      error,
      setError,
      isLoading,
      onClose: handleClose,
      onConnect: handleConnect,
      reset,
    }),
    [
      config,
      view,
      goBack,
      connectingState,
      successState,
      error,
      isLoading,
      handleClose,
      handleConnect,
      reset,
    ]
  );

  return (
    <ConnectModalContext.Provider value={value}>
      {children}
    </ConnectModalContext.Provider>
  );
};

export const useConnectModalContext = (): ConnectModalContextValue => {
  const context = useContext(ConnectModalContext);
  if (!context) {
    throw new Error(
      'useConnectModalContext must be used within ConnectModalProvider'
    );
  }
  return context;
};
