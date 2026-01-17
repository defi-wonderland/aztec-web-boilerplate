# AztecWallet - Roadmap to Standalone Library

> **Note:** This file is intentional. These are the next steps to convert aztec-wallet into a fully standalone, publishable library. Do not delete this file.

## Current Status

AztecWallet is functional but currently tied to the host application through:

- UI component imports (`src/components/ui`)
- Utility imports (`src/utils`)
- CSS variables from `globals.css`

---

## 🔴 Critical (Library won't work without these)

### 1. Remove UI Component Dependencies

**Current state:**

```tsx
// These imports tie the library to the host app
import { Button, Dialog, DialogContent, ... } from '../../../components/ui';
import { cn, iconSize } from '../../../utils';
```

**Files affected:**

- `components/ConnectButton/ConnectButton.tsx` - uses Button from host
- `components/ConnectModal/ConnectModal.tsx` - uses Dialog components
- `components/AccountModal/AccountModal.tsx` - uses Dialog components
- `components/NetworkModal/NetworkModal.tsx` - uses Dialog components
- `components/shared/Spinner.tsx` - uses cn from host
- Multiple files using `iconSize` utility

**Solution options:**

1. Copy required UI components into `aztec-wallet/components/ui/`
2. Use Radix primitives directly with internal styling
3. Create minimal internal versions of needed components

### 2. Self-contained CSS/Theming

**Current state:**
Components use Tailwind classes that reference CSS variables defined in `globals.css`:

```css
bg-surface, bg-surface-secondary, text-default, text-muted,
border-default, border-accent, etc.
```

**Solution options:**

1. Include a CSS file with default variable definitions
2. Use CSS-in-JS (styled-components, emotion)
3. Use inline styles with theme context
4. Provide CSS variables that users must define

### 3. Package.json

Create `src/aztec-wallet/package.json`:

```json
{
  "name": "@aztec/wallet-kit",
  "version": "0.1.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@aztec/aztec.js": "^0.x.x"
  },
  "dependencies": {
    "zustand": "^4.x.x",
    "@radix-ui/react-dialog": "^1.x.x",
    "lucide-react": "^0.x.x"
  }
}
```

### 4. Build Configuration

Set up bundling with tsup, rollup, or vite library mode:

- ESM output
- CJS output (optional)
- TypeScript declarations (.d.ts)
- Source maps

---

## 🟡 Important (For good developer experience)

### 5. Theming API

Allow users to customize appearance:

**Option A: CSS Variables**

```tsx
// User provides CSS variables
:root {
  --aztec-wallet-accent: #your-color;
  --aztec-wallet-background: #your-bg;
}
```

**Option B: Theme prop**

```tsx
<AztecWalletProvider
  config={config}
  theme={{
    colors: { accent: '#...', background: '#...' },
    borderRadius: 'lg',
  }}
>
```

### 6. Tree-shaking Support

Ensure individual imports work:

```tsx
// Should work without importing entire library
import { ConnectButton } from 'aztec-wallet/components';
import { useConnectModal } from 'aztec-wallet/hooks';
```

### 7. TypeScript Declarations

Ensure all public APIs have proper type exports:

- Component props types
- Hook return types
- Configuration types
- Connector types

---

## 🟢 Nice-to-have

### 8. Storybook

Component preview and documentation.

### 9. Tests

Unit tests for hooks and integration tests for components.

### 10. Demo App

Separate example application showing usage.

### 11. CI/CD

GitHub Actions for:

- Running tests
- Building library
- Publishing to npm

### 12. Documentation Site

Dedicated docs with examples, API reference, guides.

---

## Estimated Effort

| Category        | Items | Effort   |
| --------------- | ----- | -------- |
| 🔴 Critical     | 4     | 2-3 days |
| 🟡 Important    | 3     | 1-2 days |
| 🟢 Nice-to-have | 5     | 2-3 days |

**Total:** ~5-8 days to full standalone library

---

## Priority Order

1. **First:** Decouple from `src/components/ui` and `src/utils`
2. **Second:** Self-contained CSS with theme defaults
3. **Third:** Package.json and build setup
4. **Fourth:** Theming API
5. **Fifth:** Everything else
