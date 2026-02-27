# Plan: Integrar Aztec Keychain (demo-wallet) en aztec-wallet

## Context

**Qué es demo-wallet**: Una app Electron + extensión de browser (Chrome/Firefox) que funciona como wallet para Aztec. La app Electron maneja cuentas, corre PXE propio, y firma transacciones. La extensión actúa como puente entre dApps y la app vía Native Messaging.

**Cómo se conectan las dApps**: Usando `@aztec/wallet-sdk` (ya instalado en nuestro proyecto v4.0.0-devnet.1-patch.0). El protocolo tiene 4 fases:
1. **Discovery** - `WalletManager.getAvailableWallets()` broadcast via `window.postMessage`
2. **Secure Channel** - ECDH key exchange via `MessagePort`
3. **Emoji Verification** - UI con grid de 9 emojis que el usuario debe confirmar (anti-MITM)
4. **Connection** - `pending.confirm()` retorna un objeto `Wallet` estándar de Aztec (proxy encriptado AES-256-GCM)

**Por qué un nuevo tipo de connector**: El demo-wallet devuelve un `Wallet` completo (no operations como Azguard). Las interacciones con contratos van directo por el `Wallet` proxy → extensión → Electron PXE. Además, el flujo de conexión tiene un paso de verificación por emojis que requiere UI custom.

**Referencia**: GregoSwap (AztecProtocol/gregoswap) usa este exacto patrón con `@aztec/wallet-sdk/manager`.

---

## Approach

Crear un `DemoWalletConnector` dedicado (no reutilizar `BrowserWalletConnector`) que:
- Maneja el flujo de discovery → verificación emoji → conexión
- Expone `getWallet(): Wallet | null` para interacción directa con contratos
- Se coordina con el modal via un **verification store** (Zustand) para el paso de emojis

---

## Files to Create (6 files)

### 1. `src/aztec-wallet/store/verification.ts` — Verification Store
Zustand store para coordinar la verificación emoji entre el adapter y el modal.

```
State: verificationHash, walletName, walletIcon, isPending
Actions:
  - requestVerification(hash, name, icon?) → Promise<boolean>  // adapter llama esto, se pausa
  - confirmVerification() → resuelve promise con true
  - cancelVerification() → resuelve promise con false
  - reset()
```

Implementación clave: patrón promise-with-resolvers. `requestVerification` crea un Promise, guarda su `resolve`, retorna el Promise. Las acciones confirm/cancel llaman a `resolve(true/false)`.

### 2. `src/aztec-wallet/adapters/demo-wallet/DemoWalletService.ts` — Wallet SDK Wrapper
Servicio que encapsula `@aztec/wallet-sdk/manager`.

```
- discover(chainInfo, appId, timeout) → WalletProvider (primer wallet encontrado)
- establishSecureChannel(provider, appId) → PendingConnection
- confirmConnection(pending) → Wallet
- cancelConnection(pending) → void
- getWallet() → Wallet | null
- disconnect()
- onDisconnected(cb)
- destroy()
```

Usa: `WalletManager.configure({ extensions: { enabled: true } })`, `provider.establishSecureChannel()`, `pending.confirm()`.

### 3. `src/aztec-wallet/adapters/demo-wallet/DemoWalletAdapter.ts` — IBrowserWalletAdapter
Implementa `IBrowserWalletAdapter` envolviendo `DemoWalletService` + verification store.

Flujo de `connect(networkName)`:
1. Construir `ChainInfo` desde network config (`{ chainId: Fr, version: Fr }`)
2. Discovery via service (timeout 30s)
3. Establecer secure channel
4. Llamar `verificationStore.requestVerification(hash, name)` — **se pausa aquí**
5. Si confirmado: `pending.confirm()` → get wallet → `wallet.getAccounts()` → return addresses
6. Si cancelado: `pending.cancel()` → throw error

`executeOperations()`: Throw con mensaje claro — las interacciones van por el `Wallet` directamente.
`toAccountWallet()`: Mock con `getAddress()` (mismo patrón que Azguard).
`getConnectedWallet()`: Método custom que retorna el `Wallet` proxy.

### 4. `src/aztec-wallet/adapters/demo-wallet/index.ts` — Re-exports

### 5. `src/aztec-wallet/assets/icons/KeychainIcon.tsx` — Icon SVG
Icono para el wallet. Placeholder key/lock icon siguiendo el patrón de `AzguardIcon.tsx`.

### 6. `src/aztec-wallet/components/ConnectModal/views/EmojiVerificationView.tsx` — Emoji UI
Nueva vista del connect modal que:
- Subscribe a verification store
- Muestra grid 3x3 de emojis usando `hashToEmoji()` de `@aztec/wallet-sdk/crypto`
- Botón "Emojis Match" → `confirmVerification()`
- Botón "Cancel" → `cancelVerification()`
- Texto explicativo sobre el propósito de la verificación
- Styled con el styles pattern (Tailwind classes en objeto `styles`)

---

## Files to Modify (9 files)

### 7. `src/aztec-wallet/config/walletPresets.ts`
Agregar preset `'aztec-keychain'` a `AZTEC_WALLET_PRESETS`:
```ts
'aztec-keychain': {
  id: 'aztec-keychain',
  name: 'Aztec Keychain',
  icon: KeychainIcon,
  getAdapter: async () => {
    const { DemoWalletAdapter } = await import('../adapters/demo-wallet');
    return new DemoWalletAdapter();
  },
  // Sin checkInstalled — la extensión no inyecta globals detectables
}
```

### 8. `src/aztec-wallet/connectors/factories.ts`
Agregar factory `aztecKeychain()`:
```ts
import { DemoWalletConnector } from './DemoWalletConnector';
export const aztecKeychain = (): ConnectorFactory => () =>
  new DemoWalletConnector({ id: 'aztec-keychain', label: 'Aztec Keychain' });
```

Nota: `DemoWalletConnector` es una clase propia (no `BrowserWalletConnector`) porque expone `getWallet()` y maneja el flujo de verificación internamente. Implementa la interfaz base `WalletConnector` con `type = WalletType.BROWSER_WALLET`.

### 9. `src/aztec-wallet/types/index.ts`
Agregar `'emoji-verification'` al tipo `ModalView`.

### 10. `src/types/walletConnector.ts`
Agregar type guard `isDemoWalletConnector()` que detecta connectors con `getWallet()`:
```ts
export const isDemoWalletConnector = (connector: WalletConnector | null | undefined): boolean =>
  connector?.type === WalletType.BROWSER_WALLET && 'getWallet' in (connector ?? {});
```

### 11. `src/aztec-wallet/components/ConnectModal/ConnectModal.tsx`
Agregar case `'emoji-verification'` al view router que renderiza `<EmojiVerificationView />`.

### 12. `src/aztec-wallet/components/ConnectModal/context.tsx`
- Subscribe a verification store (`useVerificationStore`)
- `useEffect` que navega a `'emoji-verification'` cuando `verificationHash` aparece
- En `handleClose`: cancelar verificación pendiente si hay una

### 13. `src/aztec-wallet/adapters/index.ts`
Export `DemoWalletAdapter` y `createDemoWalletAdapter`.

### 14. `src/aztec-wallet/assets/icons/index.ts`
Export `KeychainIcon`.

### 15. `src/config/aztecWalletConfig.ts`
Agregar `'aztec-keychain'` al array de aztecWallets:
```ts
aztecWallets: ['azguard', 'aztec-keychain']
```

---

## Hooks Integration

Los hooks `useWriteContract` y `useReadContract` necesitan reconocer el `DemoWalletConnector` y usar su `getWallet()` directamente (en vez del path de `executeOperations` de browser wallets):

**`src/hooks/contracts/useWriteContract.ts`**: Agregar check `isDemoWalletConnector(connector)` ANTES del check `isBrowserWalletConnector`. Si es demo-wallet, obtener `connector.getWallet()` y usar el flujo estándar `Contract.at(address, artifact, wallet).methods.xxx().send()`.

**`src/hooks/contracts/useReadContract.ts`**: Mismo patrón — detectar demo-wallet connector y retornar `{ type: 'app_managed', wallet }` para usar el path de lectura estándar.

---

## Implementation Order

| Phase | What | Files |
|-------|------|-------|
| 1 | Core infra | verification.ts, KeychainIcon, types ModalView |
| 2 | Adapter layer | DemoWalletService, DemoWalletAdapter, adapters/index |
| 3 | Connector + registration | DemoWalletConnector (nuevo), factories, walletPresets, walletConnector types |
| 4 | Hooks update | useWriteContract, useReadContract |
| 5 | Modal UI | EmojiVerificationView, ConnectModal router, context subscription |
| 6 | App config | aztecWalletConfig.ts, aztec-wallet/index.ts exports |

---

## Open Questions / Risks

1. **ChainInfo `version`**: Se necesita el `rollupVersion` para discovery. Opciones: hardcodear por network, o agregar a network constants. Recomendación: agregar `rollupVersion` a la config de cada network.

2. **Version compatibility**: Nuestro proyecto usa `4.0.0-devnet.1-patch.0`, el demo-wallet usa `4.0.0-devnet.2-patch.1`. El protocolo de comunicación debería ser compatible pero necesita testing real.

3. **`send_transaction` via operations**: El adapter no soporta `executeOperations()` porque el `Wallet` proxy espera `ExecutionPayload` (no generic `ContractCall`). La solución es que los hooks detecten el connector y usen el `Wallet` directamente. Esto funciona para todo el flujo de contratos del boilerplate.

4. **Fee payment**: El demo-wallet maneja fees internamente via su PXE. El `createFeePaymentMethod` de los hooks podría no aplicar. Manejar gracefully — skip fee method o usar default del wallet.

5. **Sin auto-reconnect**: Cada sesión requiere nuevo discovery + verificación emoji. Aceptable para MVP.

6. **Discovery timeout UX**: Si el demo-wallet no está corriendo, discovery expira en 30s. Necesitamos buen error messaging ("Make sure Aztec Keychain is running and the browser extension is installed").

---

## Verification

1. **Build**: `yarn build-app` compila sin errores
2. **Lint**: `yarn lint` pasa
3. **Unit tests**: `yarn test:unit` — los tests existentes no se rompen
4. **Manual test con demo-wallet**:
   - Instalar la extensión del demo-wallet + app Electron
   - Abrir la app, ir al connect modal
   - "Aztec Keychain" aparece en la lista de Aztec wallets
   - Click → spinner de connecting → emoji grid aparece
   - Verificar emojis → conexión exitosa
   - Interactuar con contratos (mint, drip, etc.)
5. **Manual test sin demo-wallet**:
   - "Aztec Keychain" aparece en la lista
   - Click → spinner → timeout → error message claro
6. **Cancel flow**: Click cancel en emoji verification → vuelve al modal principal
