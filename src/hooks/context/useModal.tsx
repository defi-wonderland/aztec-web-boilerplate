import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

// This is like a temporary solution to handle modals, but we should replace it with zustanda logic
// TODO: Replace all this with zustand logic

/**
 * Modal state for tracking open modals
 */
type ModalState = Record<string, boolean>;

/**
 * Modal context value
 */
interface ModalContextValue {
  /**
   * Check if a specific modal is open
   */
  isOpen: (modalId: string) => boolean;
  /**
   * Open a specific modal
   */
  openModal: (modalId: string) => void;
  /**
   * Close a specific modal
   */
  closeModal: (modalId: string) => void;
  /**
   * Toggle a specific modal
   */
  toggleModal: (modalId: string) => void;
  /**
   * Close all open modals
   */
  closeAll: () => void;
  /**
   * Get the list of currently open modal IDs
   */
  openModals: string[];
}

const ModalContext = createContext<ModalContextValue | null>(null);

/**
 * Props for the ModalProvider component
 */
interface ModalProviderProps {
  children: ReactNode;
}

/**
 * Provider component for the modal system.
 * Wrap your app with this provider to enable modal management.
 *
 * @example
 * ```tsx
 * <ModalProvider>
 *   <App />
 * </ModalProvider>
 * ```
 */
export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [modalState, setModalState] = useState<ModalState>({});

  const isOpen = useCallback(
    (modalId: string) => Boolean(modalState[modalId]),
    [modalState]
  );

  const openModal = useCallback((modalId: string) => {
    setModalState((prev) => ({ ...prev, [modalId]: true }));
  }, []);

  const closeModal = useCallback((modalId: string) => {
    setModalState((prev) => ({ ...prev, [modalId]: false }));
  }, []);

  const toggleModal = useCallback((modalId: string) => {
    setModalState((prev) => ({ ...prev, [modalId]: !prev[modalId] }));
  }, []);

  const closeAll = useCallback(() => {
    setModalState({});
  }, []);

  const openModals = useMemo(
    () => Object.keys(modalState).filter((id) => modalState[id]),
    [modalState]
  );

  const value = useMemo<ModalContextValue>(
    () => ({
      isOpen,
      openModal,
      closeModal,
      toggleModal,
      closeAll,
      openModals,
    }),
    [isOpen, openModal, closeModal, toggleModal, closeAll, openModals]
  );

  return (
    <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
  );
};

/**
 * Hook to access the modal system.
 * Must be used within a ModalProvider.
 *
 * @example
 * ```tsx
 * const { openModal, closeModal, isOpen } = useModalContext();
 *
 * // Open a modal
 * openModal('connect-wallet');
 *
 * // Check if modal is open
 * if (isOpen('connect-wallet')) {
 *   // ...
 * }
 * ```
 */
export const useModalContext = (): ModalContextValue => {
  const context = useContext(ModalContext);

  if (!context) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }

  return context;
};

/**
 * Hook for a specific modal. Returns typed helpers for that modal.
 * Must be used within a ModalProvider.
 *
 * @param modalId - The unique identifier for the modal
 * @returns Object with isOpen state and control functions
 *
 * @example
 * ```tsx
 * const { isOpen, open, close, toggle, onOpenChange } = useModal('connect-wallet');
 *
 * return (
 *   <>
 *     <Button onClick={open}>Connect Wallet</Button>
 *     <Dialog open={isOpen} onOpenChange={onOpenChange}>
 *       <DialogContent>...</DialogContent>
 *     </Dialog>
 *   </>
 * );
 * ```
 */
export const useModal = (modalId: string) => {
  const context = useModalContext();

  const isOpen = context.isOpen(modalId);

  const open = useCallback(() => {
    context.openModal(modalId);
  }, [context, modalId]);

  const close = useCallback(() => {
    context.closeModal(modalId);
  }, [context, modalId]);

  const toggle = useCallback(() => {
    context.toggleModal(modalId);
  }, [context, modalId]);

  // For Radix UI Dialog compatibility
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        context.openModal(modalId);
      } else {
        context.closeModal(modalId);
      }
    },
    [context, modalId]
  );

  return {
    isOpen,
    open,
    close,
    toggle,
    onOpenChange,
  };
};

/**
 * Modal IDs used in the application.
 * Define your modal IDs here for type safety and autocomplete.
 */
export const MODAL_IDS = {
  CONNECT_WALLET: 'connect-wallet',
  CONFIRM_ACTION: 'confirm-action',
  SETTINGS: 'settings',
} as const;

export type ModalId = (typeof MODAL_IDS)[keyof typeof MODAL_IDS];
