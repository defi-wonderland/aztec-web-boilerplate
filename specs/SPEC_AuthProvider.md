# Spec: Vendorable AuthProvider

**Target:** `defi-wonderland/aztec-web-boilerplate` (optional — auth may be app-specific)  
**File:** `src/providers/AuthProvider.tsx` or equivalent  
**Purpose:** Generalize the auth/session provider so it can be vendored without app-specific storage keys.

---

## 1. Problem

The current `AuthProvider` hardcodes:

| Issue | Current State | Why It Blocks Vendoring |
|-------|---------------|-------------------------|
| **Storage key** | `SESSION_STORAGE_KEY = "hive_auth_session"` | Apps need unique keys; auth state is per-app. |
| **Session timeout** | `24 * 60 * 60 * 1000` | Apps may want different timeouts. |

---

## 2. Goal

The provider should:

1. Accept optional `storageKey` and `sessionTimeout` props.
2. Default to generic values when not provided.
3. Remain optional — not all boilerplate apps may use auth.

---

## 3. Proposed API

### 3.1 Config Interface

```typescript
export interface AuthProviderProps {
  children: React.ReactNode;

  /**
   * Session timeout in milliseconds. Default: 24 hours.
   */
  sessionTimeout?: number;

  /**
   * localStorage key for session persistence.
   * Default: "aztec_auth_session".
   */
  storageKey?: string;
}
```

### 3.2 Usage

```typescript
const key = storageKey ?? "aztec_auth_session";
const timeout = sessionTimeout ?? 24 * 60 * 60 * 1000;
```

---

## 4. Example: App Usage

```typescript
// Hive
<AuthProvider
  sessionTimeout={24 * 60 * 60 * 1000}
  storageKey="hive_auth_session"
>
  {children}
</AuthProvider>

// Minimal app (uses defaults)
<AuthProvider>{children}</AuthProvider>
```

---

## 5. Summary

| Change | Purpose |
|--------|---------|
| `storageKey` prop | App-owned localStorage key |
| `sessionTimeout` prop | Configurable session duration (already exists in some implementations) |

---

## 6. Note on Priority

Auth/session is often app-specific. The boilerplate may not ship an AuthProvider. If it does, making it configurable allows reuse. If not, this spec serves as guidance for apps that implement their own.
