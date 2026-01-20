# Plan de Migración: aztec-wallet como Librería Independiente

> **Objetivo:** Consolidar toda la lógica de wallet en `src/aztec-wallet/` y eliminar la duplicación del boilerplate.
>
> **Estado:** En progreso
>
> **Última actualización:** 2026-01-20

---

## Resumen de Cambios

### Archivos ELIMINADOS (migración completada)
- ~~`src/providers/UniversalWalletProvider.tsx`~~ - Eliminado en Fase 3
- ~~`src/hooks/context/useUniversalWallet.ts`~~ - Eliminado en Fase 3
- ~~`src/hooks/context/useEVMWallet.ts`~~ - Eliminado en Fase 2, usar `useAztecWallet().signer` directamente
- ~~`src/sdk/walletKit.ts`~~ - Eliminado en Fase 3
- ~~`src/sdk/walletKitConfig.ts`~~ - Eliminado en Fase 3, tipos migrados a `aztec-wallet/types/config.ts`
- ~~`src/sdk/`~~ - Carpeta eliminada (quedó vacía)
- ~~`src/config/walletKit.ts`~~ - Eliminado en Fase 3, usar `aztecWalletConfig.ts`

### Archivos ACTUALIZADOS en el boilerplate (Fase 2)
- ✅ `src/providers/AppProvider.tsx` - Usando AztecWalletProvider
- ✅ `src/providers/EmbeddedContractProvider.tsx` - Usando useAztecWallet
- ✅ `src/providers/ContractRegistryInitializer.tsx` - Usando useAztecWallet
- ✅ `src/containers/DripperCard.tsx` - Usando useAztecWallet
- ✅ `src/containers/MainContent.tsx` - Usando useAztecWallet
- ✅ `src/hooks/contracts/useContractRegistration.ts` - Usando useAztecWallet

### Archivos MEJORADOS en aztec-wallet (Fase 1)
- ✅ `src/aztec-wallet/hooks/useAztecWallet.ts` - Props adicionales agregadas
- ✅ `src/aztec-wallet/index.ts` - Servicios exportados
- ✅ `src/aztec-wallet/types/config.ts` - Agregado `StoreNetworkPreset` (Fase 3)

---

## Fase 1: Preparar aztec-wallet ✅

### 1.1 Extender useAztecWallet con props faltantes

- [x] **1.1.1** Agregar `connector` (objeto WalletConnector completo) al return *(ya existía)*
- [x] **1.1.2** Agregar `connectors` (array de todos los connectors disponibles) *(ya existía)*
- [x] **1.1.3** Agregar `isPXEInitialized` (basado en pxeStatus === 'ready' || walletType === BROWSER_WALLET)
- [x] **1.1.4** Agregar `isLoading` (status connecting/deploying || connectingConnectorId !== null)
- [x] **1.1.5** Agregar `needsSigner` (walletType === EXTERNAL_SIGNER && evmAddress === null)
- [x] **1.1.6** Agregar `currentConfig` (NetworkConfig completo, alias de network)

### 1.2 Agregar acceso a servicios internos

- [x] **1.2.1** Agregar `getPXE()` al return de useAztecWallet (para Embedded/ExternalSigner)
- [x] **1.2.2** Agregar `getWallet()` al return de useAztecWallet
- [x] **1.2.3** Exponer `signer` object para External Signer:
  ```typescript
  signer: {
    address: Hex | null;
    isAvailable: boolean;
    isConnecting: boolean;
    connect: (rdns?: string) => Promise<Hex | undefined>;
    disconnect: () => void;
    getService: () => EVMWalletService;
  }
  ```

### 1.3 Exportar servicios desde index.ts

- [x] **1.3.1** Exportar `SharedPXEService` y `SharedPXEInstance`
- [x] **1.3.2** Exportar `EVMWalletService`, `getEVMWalletService`, `createEVMWalletService`
- [x] **1.3.3** Exportar `AztecStorageService`
- [x] **1.3.4** Exportar `NetworkService`
- [x] **1.3.5** Exportar tipos necesarios: `WalletConnector`, `WalletConnectorId`, `WalletType`, `ConnectorStatus`, type guards

### 1.4 Agregar network utilities

- [x] **1.4.1** Exportar `buildNetworkOptions()` *(disponible via store exports)*
- [x] **1.4.2** Agregar `getNetworkOptions()` al return de useAztecWallet
- [x] **1.4.3** Agregar `resetToDefault()` al return de useAztecWallet

### 1.5 Integrar WalletKit en aztec-wallet

- [x] **1.5.1** `AztecWalletKit` se eliminará en Fase 3 (usa `createConnectorRegistry` internamente)
- [x] **1.5.2** `createConnectorRegistry` ya está exportado correctamente
- [x] **1.5.3** `AztecWalletProvider` ya maneja inicialización via `AutoReconnect`

---

## Fase 2: Actualizar consumidores en el boilerplate ✅

### 2.1 Actualizar AppProvider

- [x] **2.1.1** Reemplazar `UniversalWalletProvider` por `AztecWalletProvider`
- [x] **2.1.2** Adaptar la configuración de `WalletKitConfig` a `AztecWalletConfig`
- [x] **2.1.3** Verificar que los children se renderizan correctamente

### 2.2 Actualizar EmbeddedContractProvider

- [x] **2.2.1** Cambiar import de `useUniversalWallet` a `useAztecWallet`
- [x] **2.2.2** Actualizar acceso a `connector` → usar nueva prop
- [x] **2.2.3** Actualizar acceso a `isInitialized` → usar nueva prop (`isPXEInitialized`)
- [x] **2.2.4** Actualizar acceso a `currentConfig` → usar `network` o nueva prop
- [x] **2.2.5** Verificar que `connector.getPXE()` funciona correctamente

### 2.3 Actualizar ContractRegistryInitializer

- [x] **2.3.1** Cambiar import de `useUniversalWallet` a `useAztecWallet`
- [x] **2.3.2** Actualizar acceso a props necesarias
- [x] **2.3.3** Verificar inicialización del registry

### 2.4 Actualizar DripperCard

- [x] **2.4.1** Cambiar import de `useUniversalWallet` a `useAztecWallet`
- [x] **2.4.2** Actualizar acceso a `account`
- [x] **2.4.3** Actualizar acceso a `isInitialized` → `isPXEInitialized`
- [x] **2.4.4** Actualizar acceso a `connectors`
- [x] **2.4.5** Actualizar acceso a `connector`
- [x] **2.4.6** Actualizar acceso a `currentConfig` para token address

### 2.5 Actualizar MainContent

- [x] **2.5.1** Cambiar import de `useUniversalWallet` a `useAztecWallet`
- [x] **2.5.2** Actualizar lógica de detección de embedded connector

### 2.6 Actualizar useContractRegistration

- [x] **2.6.1** Cambiar import de `useUniversalWallet` a `useAztecWallet`
- [x] **2.6.2** Actualizar acceso a `connector`
- [x] **2.6.3** Actualizar acceso a `account`
- [x] **2.6.4** Actualizar acceso a `currentConfig`
- [x] **2.6.5** Actualizar acceso a `walletType`
- [x] **2.6.6** Verificar que el proxy para browser wallet funciona

### 2.7 useEVMWallet

- [x] **2.7.1** Decisión: Eliminar - `useAztecWallet().signer` ya provee toda la funcionalidad
- [x] **2.7.2** Archivo eliminado: `src/hooks/context/useEVMWallet.ts`
- [x] **2.7.3** Export eliminado de `src/hooks/context/index.ts`

### 2.8 Actualizar archivos adicionales

- [x] **2.8.1** Actualizar `Layout.tsx` - usar `useAztecWallet` y `isPXEInitialized`
- [x] **2.8.2** Actualizar `ContractInteractionCard.tsx` - usar `useAztecWallet`
- [x] **2.8.3** Actualizar `useTokenBalance.ts` - usar `useAztecWallet` y type guards de aztec-wallet
- [x] **2.8.4** Actualizar `useDripper.ts` - usar `useAztecWallet`
- [x] **2.8.5** Actualizar `useReadContract.ts` - usar `useAztecWallet` y type guards
- [x] **2.8.6** Actualizar `useContractDeployer.ts` - usar `useAztecWallet` y type guards
- [x] **2.8.7** Actualizar `useDynamicContractCaller.ts` - usar `useAztecWallet` y type guards
- [x] **2.8.8** Actualizar `useWriteContract.ts` - usar `useAztecWallet` y type guards
- [x] **2.8.9** Remover export de `useUniversalWallet` de `src/hooks/context/index.ts`

---

## Fase 3: Eliminar código legacy ✅

### 3.1 Eliminar archivos

- [x] **3.1.1** Eliminar `src/providers/UniversalWalletProvider.tsx`
- [x] **3.1.2** Eliminar `src/hooks/context/useUniversalWallet.ts`
- [x] **3.1.3** Eliminar `src/hooks/context/useEVMWallet.ts` - **Completado en Fase 2**
- [x] **3.1.4** Eliminar `src/sdk/walletKit.ts`
- [x] **3.1.5** Eliminar `src/sdk/walletKitConfig.ts`
- [x] **3.1.6** Eliminar carpeta `src/sdk/` (quedó vacía)
- [x] **3.1.7** Eliminar `src/config/walletKit.ts` (ya no se usaba)

### 3.2 Limpiar exports

- [x] **3.2.1** Actualizar `src/hooks/context/index.ts` - ya estaba limpio (Fase 2)
- [x] **3.2.2** Actualizar `src/providers/index.ts` - remover UniversalWalletProvider
- [x] **3.2.3** Buscar y eliminar cualquier import huérfano (actualizado comentario en useAztecWallet)

### 3.3 Actualizar configuración

- [x] **3.3.1** Crear `StoreNetworkPreset` en aztec-wallet para el store interno
- [x] **3.3.2** Actualizar imports en `store/network/store.ts` y `selectors.ts`
- [x] **3.3.3** `NetworkPreset` y `ConnectorFactory` ya vienen de aztec-wallet


## Fase 4: Documentación ✅

### 4.1 Actualizar CLAUDE.md

- [x] **4.1.1** Actualizar sección de Wallet System
- [x] **4.1.2** Remover referencias a UniversalWalletProvider
- [x] **4.1.3** Documentar uso de useAztecWallet

### 4.2 Actualizar README de aztec-wallet

- [x] **4.2.1** Documentar todas las props de useAztecWallet
- [x] **4.2.2** Documentar servicios exportados
- [x] **4.2.3** Agregar ejemplos de uso avanzado

---

## Notas y Decisiones

### Decisiones tomadas

| Fecha | Decisión | Razón |
|-------|----------|-------|
| 2025-01-20 | Plan creado | Análisis inicial completado |

### Decisiones pendientes

| Item | Opciones | Estado |
|------|----------|--------|
| Network presets | Built-in vs configurable | Pendiente |
| AztecStorageService | Parte de lib vs pluggable | Pendiente |
| Wallet adapters | Built-in vs plugins | Pendiente |
| useEVMWallet | Eliminar vs mantener como wrapper | ✅ Eliminado - `signer` ya provee todo |

### Riesgos identificados

1. **Breaking changes en APIs** - Los consumidores de useUniversalWallet necesitarán actualizar su código
2. **Cross-tab sync** - Verificar que funciona igual en AztecWalletProvider
3. **PXE initialization timing** - Asegurar que isInitialized se calcula correctamente

---

## Progreso

| Fase | Tareas | Completadas | % |
|------|--------|-------------|---|
| Fase 1 | 19 | 19 | 100% ✅ |
| Fase 2 | 33 | 33 | 100% ✅ |
| Fase 3 | 10 | 10 | 100% ✅ |
| Fase 4 | 6 | 6 | 100% ✅ |
| Fase 5 | 5 | 0 | 0% |
| **Total** | **73** | **68** | **93%** |
