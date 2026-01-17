# AztecWallet - Session Changes Log

> **Note:** This file documents significant changes made to aztec-wallet. It serves as context for future development sessions. Do not delete this file.

---

## Session: January 2025 - RainbowKit-style Architecture Refactor

### Summary

Refactored aztec-wallet to work like RainbowKit:

- Modals render automatically (no manual setup required)
- ConnectButton is "smart" and handles everything
- Hooks available for programmatic modal control

---

## Architecture Changes

### 1. Global Modal State (Zustand Store)

**Created:** `store/modal.ts`

Centralized modal state management:

```typescript
type ModalType = 'connect' | 'account' | 'network' | null;

const useModalStore = create({
  openModal: null,
  openConnectModal: () => set({ openModal: 'connect' }),
  openAccountModal: () => set({ openModal: 'account' }),
  openNetworkModal: () => set({ openModal: 'network' }),
  closeModal: () => set({ openModal: null }),
});
```

### 2. Automatic Modal Rendering

**Created:** `components/AztecWalletModals/AztecWalletModals.tsx`

Internal component that renders all modals. Automatically included in `AztecWalletProvider`:

```tsx
// In AztecWalletProvider.tsx
return (
  <AztecWalletContext.Provider value={contextValue}>
    {children}
    <AztecWalletModals />{' '}
    {/* Renders ConnectModal, AccountModal, NetworkModal */}
  </AztecWalletContext.Provider>
);
```

### 3. Smart ConnectButton

**Updated:** `components/ConnectButton/ConnectButton.tsx`

Now handles everything automatically:

- Disconnected → Shows gradient CTA, opens ConnectModal on click
- Connecting → Shows loading shimmer
- Connected → Shows NetworkPicker (if enabled) + address avatar, opens AccountModal on click

Props:

```typescript
interface ConnectButtonProps {
  label?: string; // Default: 'Connect Wallet'
  icon?: ReactNode | false | null; // Default: Wallet icon
  className?: string;
}
```

### 4. Modal Hooks Updated

**Updated:** `hooks/useConnectModal.ts`, `hooks/useAccountModal.ts`, `hooks/useNetworkModal.ts`

All now use the global modal store instead of local state:

```typescript
export function useConnectModal() {
  const openModal = useModalStore((state) => state.openModal);
  const openConnectModal = useModalStore((state) => state.openConnectModal);
  const closeModal = useModalStore((state) => state.closeModal);

  return {
    isOpen: openModal === 'connect',
    open: openConnectModal,
    close: closeModal,
    onOpenChange: (open) => (open ? openConnectModal() : closeModal()),
  };
}
```

### 5. NetworkPicker Simplified

**Updated:** `components/NetworkPicker/NetworkPicker.tsx`

- No longer renders its own NetworkModal (modal is in AztecWalletModals)
- Just triggers the global modal via `useNetworkModal` hook
- Added ChevronDown icon
- Adjusted padding for visual consistency

---

## Dead Code Removed

### 1. Theme System (Deleted)

**Deleted:** `theme/` folder

- `theme/types.ts`
- `theme/themes.ts`
- `theme/createTheme.ts`
- `theme/index.ts`

**Reason:** Was not connected to components. Styling uses Tailwind with CSS variables from `globals.css`.

### 2. createModalHook Factory (Deleted)

**Deleted:** `hooks/createModalHook.ts`

**Reason:** Replaced by Zustand modal store. All modal hooks now use the global store directly.

### 3. AccountDropdown Component (Deleted)

**Deleted:** `components/AccountDropdown/` folder

**Reason:** Legacy component, replaced by AccountModal.

### 4. Unused connectingState.message

**Updated:** `components/ConnectModal/context.tsx`

Removed `message` property from `ConnectingState` interface - it was being set but never displayed.

---

## Code Quality Fixes

### 1. Fixed \_walletType Unused Parameter

**File:** `components/AztecWalletModals/AztecWalletModals.tsx`

Changed from looking up `connector.type` to using the `walletType` parameter directly:

```typescript
// Before
async (walletId: string, _walletType: 'embedded' | 'aztec' | 'evm') => {
  const connector = walletState.connectors.find((c) => c.id === walletId);
  if (connector.type === 'embedded') { ... }
}

// After
async (walletId: string, walletType: 'embedded' | 'aztec' | 'evm') => {
  if (walletType === 'embedded') { ... }
}
```

### 2. Fixed Inline Styles (CLAUDE.md Pattern)

**File:** `components/shared/Spinner.tsx`

- Moved `'text-accent'` from inline cn() call to styles object

**File:** `components/ConnectModal/ConnectModal.tsx`

- Added `styles.header` instead of inline `className="mb-4"`

---

## Export Changes

### Removed from `index.ts`:

```typescript
// Theme (deleted)
-darkTheme,
  lightTheme,
  createTheme,
  ThemeConfig,
  PartialThemeConfig -
    // createModalHook (deleted)
    createModalHook,
  ModalHookReturn -
    // AccountDropdown (deleted)
    AccountDropdown,
  AccountDropdownProps;
```

### Config Type Updated:

**File:** `types/config.ts`

Removed `theme` property from `AztecWalletConfig`:

```typescript
// Removed
theme?: ThemeConfig | 'light' | 'dark';
```

---

## Usage Changes (For End Users)

### Before (Manual Modal Setup):

```tsx
function App() {
  return (
    <AztecWalletProvider config={config}>
      <Header />
      <ConnectModal open={...} onOpenChange={...} ... />
      <AccountModal open={...} onOpenChange={...} ... />
      <NetworkModal open={...} onOpenChange={...} ... />
    </AztecWalletProvider>
  );
}

function Header() {
  const { isOpen, open } = useConnectModal();
  const { isConnected, address } = useAztecWallet();

  return (
    <>
      <NetworkPicker variant="full" />
      <button onClick={isConnected ? openAccountModal : open}>
        {isConnected ? address : 'Connect'}
      </button>
    </>
  );
}
```

### After (Automatic - RainbowKit Style):

```tsx
function App() {
  return (
    <AztecWalletProvider config={config}>
      <Header />
      {/* Modals are automatic! */}
    </AztecWalletProvider>
  );
}

function Header() {
  return <ConnectButton />; // That's it!
}
```

### Programmatic Control (Still Works):

```tsx
function CustomButton() {
  const { open } = useConnectModal();
  return <button onClick={open}>My Custom Connect</button>;
}
```

---

## Files Modified Summary

| Action  | Files                                                                                                                                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Created | `store/modal.ts`, `components/AztecWalletModals/`                                                                                                                                                                                                       |
| Deleted | `theme/*`, `hooks/createModalHook.ts`, `components/AccountDropdown/`                                                                                                                                                                                    |
| Updated | `providers/AztecWalletProvider.tsx`, `components/ConnectButton/`, `components/NetworkPicker/`, `hooks/useConnectModal.ts`, `hooks/useAccountModal.ts`, `hooks/useNetworkModal.ts`, `components/ConnectModal/context.tsx`, `types/config.ts`, `index.ts` |

---

## Network Presets

Added as single source of truth for network icons/names:

**File:** `config/networkPresets.ts`

```typescript
// Built-in icons for common networks
devnet → Globe icon
sandbox → FlaskConical icon
testnet → Box icon
mainnet → Rocket icon

// Helper functions
getNetworkIcon(name, configIcon?)
getNetworkDisplayName(name, configDisplayName?)
```

Used in: AccountModal (network section), NetworkModal, NetworkPicker

---

## Key Decisions Made

1. **Modals are automatic** - Rendered by provider, not by user
2. **ConnectButton includes NetworkPicker** - Based on `config.showNetworkPicker`
3. **Theme system removed** - Not implemented properly, use CSS variables instead
4. **Hooks use global store** - Consistent behavior across app
5. **Network presets as source of truth** - Icons and names centralized
