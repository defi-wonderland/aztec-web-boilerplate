# Plan: Sistema de Wallet Modular (AztecKit)

## Decisiones de Arquitectura

| Decisión | Elección | Razón |
|----------|----------|-------|
| **Estado** | Zustand (bundleado) | Como RainbowKit - pragmático y simple |
| **Provider** | Sí, ligero | Config + inicialización + SSR safety + testing |
| **Estructura** | `src/aztec-kit/` | Extraíble como package en el futuro |
| **Theming** | CSS variables + Tailwind | Compatible con el sistema actual |

---

## Resumen del Diseño Propuesto

Basado en los diagramas de `wallet-flow/`, el nuevo sistema de wallet tiene:

### Flujo de Conexión (Imagen 1)
```
┌─────────────────────────────────┐
│        Connect Wallet           │
│         (and have info)         │
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │   use embedded account    │──┼──►  [Generating...] → [Loading...] → [Success]
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │     ┌──────────────────────┐
│  │   connect Aztec Wallet    │──┼──►  │  Connect Wallet      │
│  └───────────────────────────┘  │     │  ← back              │
│  ┌───────────────────────────┐  │     │  [Obsidian]          │ → [Connecting...] → [Success]
│  │      use EVM Account      │──┼──►  │  [Azguard]           │
│  └───────────────────────────┘  │     └──────────────────────┘
└─────────────────────────────────┘
                                        ┌──────────────────────┐
                                        │  Connect Wallet      │
                                        │  ← back              │
                                        │  [Metamask]          │ → [Connecting...] → [Success]
                                        │  [Rabby]             │
                                        └──────────────────────┘
```

### Pantalla de Éxito
```
┌─────────────────────────────────┐
│  wallet connected successfully ✓│
│                                 │
│  Account                        │
│  ┌───────────────────────────┐  │
│  │      0x....0000           │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │        Continue           │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Estado Conectado (Imagen 2)
```
Header: [ ...contenido... ][ 0x....0000 ▼]

                           ┌──────────────────┐
                           │ Account          │
                           │ ┌──────────────┐ │
                           │ │ 0x....0000   │ │
                           │ └──────────────┘ │
                           │ Network          │
                           │ ┌──────────────┐ │
                           │ │   Devnet     │ │
                           │ └──────────────┘ │
                           │ ┌──────────────┐ │
                           │ │  Disconnect  │ │
                           │ └──────────────┘ │
                           └──────────────────┘
```

---

## Requisitos de Modularidad

Para que sea extraíble como package (estilo RainbowKit):

1. **Configuración declarativa** - El dev define qué grupos y wallets mostrar
2. **Theming** - Sistema de temas personalizable
3. **Componentes headless** - Lógica separada de presentación
4. **Hooks públicos** - API limpia para acceder al estado
5. **Tree-shakeable** - Solo incluye lo que se usa

---

## Arquitectura Propuesta

### Estructura de Carpetas
```
src/
├── aztec-kit/                      # ← TODO extraíble como package
│   ├── index.ts                    # Exports públicos
│   │
│   ├── config/
│   │   ├── types.ts                # Tipos de configuración
│   │   ├── defaults.ts             # Configuraciones por defecto
│   │   └── createConfig.ts         # Factory de configuración
│   │
│   ├── connectors/                 # (existente, mover aquí)
│   │   ├── types.ts
│   │   ├── EmbeddedConnector.ts
│   │   ├── ExternalSignerConnector.ts
│   │   ├── BrowserWalletConnector.ts
│   │   ├── registry.ts
│   │   └── factories.ts
│   │
│   ├── adapters/                   # (existente, mover aquí)
│   │   └── azguard/
│   │
│   ├── providers/
│   │   ├── AztecKitProvider.tsx    # Provider principal
│   │   └── context.ts              # Contexto interno
│   │
│   ├── hooks/
│   │   ├── useAztecKit.ts          # Hook principal (reemplaza useUniversalWallet)
│   │   ├── useConnectModal.ts      # Control del modal
│   │   ├── useAccountState.ts      # Estado de cuenta
│   │   └── useNetworkState.ts      # Estado de red
│   │
│   ├── components/
│   │   ├── ConnectModal/
│   │   │   ├── ConnectModal.tsx           # Modal principal
│   │   │   ├── ConnectModalContent.tsx    # Layout del contenido
│   │   │   ├── views/
│   │   │   │   ├── MainView.tsx           # Vista inicial con 3 grupos
│   │   │   │   ├── AztecWalletsView.tsx   # Lista de Aztec wallets
│   │   │   │   ├── EVMWalletsView.tsx     # Lista de EVM wallets
│   │   │   │   ├── ConnectingView.tsx     # Estado de carga
│   │   │   │   └── SuccessView.tsx        # Conexión exitosa
│   │   │   └── index.ts
│   │   │
│   │   ├── ConnectButton/
│   │   │   ├── ConnectButton.tsx          # Botón principal
│   │   │   └── index.ts
│   │   │
│   │   ├── AccountDropdown/
│   │   │   ├── AccountDropdown.tsx        # Dropdown cuando conectado
│   │   │   └── index.ts
│   │   │
│   │   └── shared/
│   │       ├── WalletButton.tsx           # Botón de wallet individual
│   │       ├── Spinner.tsx                # Loading spinner
│   │       └── AddressDisplay.tsx         # Display de dirección
│   │
│   ├── store/                      # (existente, mover aquí)
│   │   └── wallet/
│   │
│   ├── services/                   # (existente, mover aquí)
│   │   ├── aztec/
│   │   └── evm/
│   │
│   └── theme/
│       ├── types.ts                # Tipos del tema
│       ├── defaultTheme.ts         # Tema por defecto
│       └── createTheme.ts          # Factory de temas
│
├── components/                     # Componentes de la app
│   ├── Header.tsx                  # Usa ConnectButton y AccountDropdown
│   └── ...
│
└── config/
    └── aztecKit.ts                 # Configuración específica de la app
```

---

## Plan de Implementación

### Fase 1: Preparación y Estructura Base
**Objetivo**: Crear la estructura de carpetas y mover código existente

#### 1.1 Crear estructura de carpetas
- [ ] Crear carpeta `src/aztec-kit/`
- [ ] Crear subcarpetas: `config/`, `providers/`, `hooks/`, `components/`, `theme/`

#### 1.2 Definir tipos de configuración
- [ ] `AztecKitConfig` - Configuración principal
- [ ] `WalletGroup` - Grupo de wallets (embedded, aztec, evm)
- [ ] `ThemeConfig` - Configuración de tema

```typescript
// src/aztec-kit/config/types.ts
export interface AztecKitConfig {
  // Redes disponibles
  networks: NetworkConfig[];
  defaultNetwork?: string;

  // Grupos de wallets habilitados
  walletGroups: {
    embedded?: EmbeddedGroupConfig | false;
    aztecWallets?: AztecWalletsGroupConfig | false;
    evmWallets?: EVMWalletsGroupConfig | false;
  };

  // Tema
  theme?: ThemeConfig | 'light' | 'dark';

  // Callbacks opcionales
  onConnect?: (account: AccountWithSecretKey) => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export interface EmbeddedGroupConfig {
  label?: string;                    // Default: "use embedded account"
  enabled?: boolean;                 // Default: true
}

export interface AztecWalletsGroupConfig {
  label?: string;                    // Default: "connect Aztec Wallet"
  wallets: AztecWalletConfig[];      // Lista de wallets
}

export interface AztecWalletConfig {
  id: string;
  name: string;
  icon?: string | React.ComponentType;
  adapter: () => IBrowserWalletAdapter;
}

export interface EVMWalletsGroupConfig {
  label?: string;                    // Default: "use EVM Account"
  wallets: EVMWalletConfig[];        // Lista de wallets
}

export interface EVMWalletConfig {
  id: string;
  name: string;
  icon?: string | React.ComponentType;
  rdns: string;                      // EIP-6963
}
```

#### 1.3 Crear factory de configuración
```typescript
// src/aztec-kit/config/createConfig.ts
export function createAztecKitConfig(config: AztecKitConfig): AztecKitConfig {
  return {
    ...defaultConfig,
    ...config,
    walletGroups: {
      embedded: config.walletGroups.embedded ?? { enabled: true },
      aztecWallets: config.walletGroups.aztecWallets,
      evmWallets: config.walletGroups.evmWallets,
    },
  };
}
```

---

### Fase 2: Sistema de Temas
**Objetivo**: Crear un sistema de theming flexible

#### 2.1 Definir tipos de tema
```typescript
// src/aztec-kit/theme/types.ts
export interface ThemeConfig {
  // Colores
  colors: {
    // Backgrounds
    modalBackground: string;
    buttonBackground: string;
    buttonBackgroundHover: string;
    buttonBackgroundActive: string;

    // Text
    textPrimary: string;
    textSecondary: string;
    textMuted: string;

    // Accents
    accent: string;
    accentHover: string;
    success: string;
    error: string;
    warning: string;

    // Borders
    border: string;
    borderFocus: string;
  };

  // Radii
  radii: {
    button: string;
    modal: string;
    input: string;
  };

  // Fonts
  fonts: {
    body: string;
  };

  // Shadows
  shadows: {
    modal: string;
    button: string;
  };
}
```

#### 2.2 Crear temas por defecto
- [ ] `lightTheme`
- [ ] `darkTheme`

#### 2.3 Crear factory de temas
```typescript
// src/aztec-kit/theme/createTheme.ts
export function createTheme(overrides: Partial<ThemeConfig>): ThemeConfig {
  return deepMerge(defaultTheme, overrides);
}
```

---

### Fase 3: Componentes del Modal
**Objetivo**: Crear los componentes visuales del modal

#### 3.1 Crear vista principal (MainView)
- [ ] Muestra los 3 grupos de wallets como botones
- [ ] Cada botón navega a su vista correspondiente
- [ ] Solo muestra grupos habilitados en config

```typescript
// src/aztec-kit/components/ConnectModal/views/MainView.tsx
const MainView = () => {
  const { config, setView } = useConnectModalContext();

  return (
    <>
      {config.walletGroups.embedded && (
        <WalletGroupButton
          label={config.walletGroups.embedded.label}
          onClick={() => handleEmbeddedConnect()}
        />
      )}
      {config.walletGroups.aztecWallets && (
        <WalletGroupButton
          label={config.walletGroups.aztecWallets.label}
          onClick={() => setView('aztec-wallets')}
        />
      )}
      {config.walletGroups.evmWallets && (
        <WalletGroupButton
          label={config.walletGroups.evmWallets.label}
          onClick={() => setView('evm-wallets')}
        />
      )}
    </>
  );
};
```

#### 3.2 Crear vista de Aztec Wallets
- [ ] Header con botón back
- [ ] Lista de wallets Aztec configurados
- [ ] Detección de wallets instalados

#### 3.3 Crear vista de EVM Wallets
- [ ] Header con botón back
- [ ] Lista de wallets EVM configurados
- [ ] Detección de wallets instalados (EIP-6963)

#### 3.4 Crear vista de Connecting
- [ ] Spinner animado
- [ ] Mensaje de estado (Generating, Loading, Connecting)
- [ ] Nombre del wallet que se está conectando

#### 3.5 Crear vista de Success
- [ ] Icono de check animado
- [ ] "wallet connected successfully"
- [ ] Display de la dirección
- [ ] Botón "Continue"

#### 3.6 Crear ConnectModal principal
- [ ] Maneja navegación entre vistas
- [ ] Mantiene estado de conexión
- [ ] Animaciones de transición

---

### Fase 4: ConnectButton y AccountDropdown
**Objetivo**: Crear los componentes para el header

#### 4.1 ConnectButton
- [ ] Estado desconectado: "Connect Wallet"
- [ ] Estado conectando: Spinner
- [ ] Estado conectado: Muestra dirección truncada
- [ ] Click abre modal o dropdown según estado

```typescript
// src/aztec-kit/components/ConnectButton/ConnectButton.tsx
export interface ConnectButtonProps {
  label?: string;           // Default: "Connect Wallet"
  showBalance?: boolean;    // Mostrar balance (futuro)
  className?: string;
}
```

#### 4.2 AccountDropdown
- [ ] Se abre al click en ConnectButton cuando conectado
- [ ] Muestra Account con dirección (copiable)
- [ ] Muestra Network actual
- [ ] Botón Disconnect

```typescript
// src/aztec-kit/components/AccountDropdown/AccountDropdown.tsx
export interface AccountDropdownProps {
  showNetwork?: boolean;    // Default: true
  showCopyButton?: boolean; // Default: true
}
```

---

### Fase 5: Provider y Hooks
**Objetivo**: Crear el sistema de contexto y hooks públicos

#### 5.1 AztecKitProvider (ligero)
- [ ] Recibe configuración
- [ ] Inicializa store UNA vez
- [ ] Inyecta tema (CSS class/variables)
- [ ] Cleanup en unmount
- [ ] NO maneja estado directamente (eso lo hace Zustand)

```typescript
// src/aztec-kit/providers/AztecKitProvider.tsx
export function AztecKitProvider({
  config,
  children
}: {
  config: AztecKitConfig;
  children: React.ReactNode
}) {
  // Inicializa store una sola vez con la config
  useEffect(() => {
    initializeStore(config);
    return () => cleanupStore();
  }, []);

  // Inyecta tema como clase CSS
  return (
    <div className={config.theme} data-aztec-kit>
      {children}
    </div>
  );
}
```

#### 5.2 useAztecKit hook
- [ ] Hook principal para acceder al estado
- [ ] Métodos para conectar/desconectar
- [ ] Estado de red

```typescript
// src/aztec-kit/hooks/useAztecKit.ts
export function useAztecKit() {
  return {
    // Estado
    isConnected: boolean,
    isConnecting: boolean,
    account: AccountWithSecretKey | null,
    address: string | null,
    walletType: WalletType | null,
    network: NetworkConfig,

    // Acciones
    connect: (connectorId?: string) => Promise<void>,
    disconnect: () => Promise<void>,
    switchNetwork: (networkName: string) => Promise<void>,

    // Modal
    openConnectModal: () => void,
    closeConnectModal: () => void,
  };
}
```

#### 5.3 useConnectModal hook
- [ ] Control del modal de conexión
- [ ] Estado de la vista actual
- [ ] Navegación entre vistas

---

### Fase 6: Migración de Código Existente
**Objetivo**: Mover y refactorizar código existente

#### 6.1 Mover conectores
- [ ] Mover `src/connectors/` → `src/aztec-kit/connectors/`
- [ ] Actualizar imports

#### 6.2 Mover adapters
- [ ] Mover `src/adapters/` → `src/aztec-kit/adapters/`
- [ ] Actualizar imports

#### 6.3 Mover store
- [ ] Mover `src/store/wallet/` → `src/aztec-kit/store/`
- [ ] Adaptar para nueva configuración

#### 6.4 Mover services
- [ ] Mover `src/services/aztec/` → `src/aztec-kit/services/aztec/`
- [ ] Mover `src/services/evm/` → `src/aztec-kit/services/evm/`

---

### Fase 7: Integración con la App
**Objetivo**: Actualizar la app para usar el nuevo sistema

#### 7.1 Crear configuración de la app
```typescript
// src/config/aztecKit.ts
import { createAztecKitConfig, azguard, metamask, rabby } from '../aztec-kit';

export const aztecKitConfig = createAztecKitConfig({
  networks: [
    { name: 'devnet', nodeUrl: '...' },
    { name: 'sandbox', nodeUrl: '...' },
  ],
  walletGroups: {
    embedded: { label: 'use embedded account' },
    aztecWallets: {
      label: 'connect Aztec Wallet',
      wallets: [
        { id: 'obsidian', name: 'Obsidian', adapter: obsidianAdapter },
        { id: 'azguard', name: 'Azguard', adapter: azguardAdapter },
      ],
    },
    evmWallets: {
      label: 'use EVM Account',
      wallets: [
        { id: 'metamask', name: 'Metamask', rdns: 'io.metamask' },
        { id: 'rabby', name: 'Rabby', rdns: 'io.rabby' },
      ],
    },
  },
});
```

#### 7.2 Actualizar AppProvider
```typescript
// src/providers/AppProvider.tsx
import { AztecKitProvider } from '../aztec-kit';
import { aztecKitConfig } from '../config/aztecKit';

export function AppProvider({ children }) {
  return (
    <AztecKitProvider config={aztecKitConfig}>
      {/* otros providers */}
      {children}
    </AztecKitProvider>
  );
}
```

#### 7.3 Actualizar Header
```typescript
// src/components/Header.tsx
import { ConnectButton, AccountDropdown } from '../aztec-kit';

// Usar ConnectButton en lugar del código actual
```

#### 7.4 Actualizar componentes que usan wallet
- [ ] Reemplazar `useUniversalWallet()` → `useAztecKit()`
- [ ] Actualizar imports

---

### Fase 8: Testing y Documentación
**Objetivo**: Asegurar calidad y documentar API

#### 8.1 Tests unitarios
- [ ] Tests para cada componente
- [ ] Tests para hooks
- [ ] Tests para conectores

#### 8.2 Tests de integración
- [ ] Flujo completo de conexión embedded
- [ ] Flujo completo de conexión Aztec wallet
- [ ] Flujo completo de conexión EVM wallet

#### 8.3 Documentación
- [ ] README del aztec-kit
- [ ] Documentación de API
- [ ] Ejemplos de uso
- [ ] Guía de customización

---

### Fase 9: Preparación para Package (Futuro)
**Objetivo**: Preparar para extracción como package separado

#### 9.1 Configuración de build
- [ ] tsconfig separado para aztec-kit
- [ ] Build script para generar dist
- [ ] Package.json para el kit

#### 9.2 Exports públicos
- [ ] Definir API pública en `src/aztec-kit/index.ts`
- [ ] Marcar internals como privados

#### 9.3 Documentación de package
- [ ] README para npm
- [ ] CHANGELOG
- [ ] Guía de migración

---

## Orden de Ejecución Recomendado

1. **Fase 1** - Preparación (estructura base)
2. **Fase 2** - Sistema de temas
3. **Fase 3** - Componentes del modal
4. **Fase 4** - ConnectButton y AccountDropdown
5. **Fase 5** - Provider y hooks
6. **Fase 6** - Migración de código existente
7. **Fase 7** - Integración con la app
8. **Fase 8** - Testing y documentación
9. **Fase 9** - Preparación para package (después de validar en producción)

---

## Notas Adicionales

### Dependencias Externas Necesarias
- Ya tenemos: Radix UI, Tailwind, Zustand, Viem
- Posible agregar: `framer-motion` para animaciones del modal

### Consideraciones de Performance
- Lazy loading de conectores
- Code splitting por grupo de wallets
- Memoización de componentes

### Consideraciones de Accesibilidad
- Focus management en el modal
- Keyboard navigation
- ARIA labels apropiados
- Soporte para screen readers
