# CLAUDE.md - Project Guidelines for Claude Code

This file provides guidance to Claude Code (claude.ai/code) when working with this codebase.

## Project Overview

This is an Aztec Web Boilerplate - a React + TypeScript application for interacting with the Aztec blockchain. It uses:

- **React 18** with TypeScript
- **Tailwind CSS v4** for styling
- **Radix UI Primitives** for accessible components
- **Lucide React** for icons
- **Vite** for bundling

## UI Development Guidelines

### The Styles Pattern (MANDATORY)

All Tailwind classes MUST be defined in a `styles` object at the top of the component file. **NEVER use inline className strings directly in JSX**.

```tsx
// ✅ CORRECT
const styles = {
  container: 'flex flex-col gap-4',
  title: 'text-lg font-semibold text-default',
} as const;

export const MyComponent = () => (
  <div className={styles.container}>
    <h1 className={styles.title}>Title</h1>
  </div>
);

// ❌ WRONG - Never do this
export const BadComponent = () => (
  <div className="flex flex-col gap-4">
    <h1 className="text-lg font-semibold">Title</h1>
  </div>
);
```

### Style Object Rules

1. Define `styles` object BEFORE the component function
2. Always use `as const` for type inference
3. Use camelCase keys describing the element's purpose
4. Group related styles with comments
5. Use nested objects for variants: `icon: { sm: 'h-4 w-4', md: 'h-5 w-5' }`

### Using cn() for Conditionals

Use `cn()` from `@/utils` only for conditional classes:

```tsx
import { cn } from '../utils';

<button className={cn(styles.button, isActive && styles.buttonActive)}>
```

### Theme-Aware Classes

Use custom utility classes from `globals.css`:

| Class                                                       | Purpose           |
| ----------------------------------------------------------- | ----------------- |
| `bg-surface`, `bg-surface-secondary`, `bg-surface-tertiary` | Background colors |
| `text-default`, `text-muted`, `text-accent`                 | Text colors       |
| `border-default`                                            | Border colors     |
| `gradient-primary`, `gradient-secondary`                    | Gradients         |
| `shadow-theme`, `shadow-theme-hover`, `shadow-theme-lg`     | Shadows           |

## UI Component Library

Always use components from `src/components/ui/` instead of native HTML elements.

### Available Components

| Component  | Usage                                                                             |
| ---------- | --------------------------------------------------------------------------------- |
| `Button`   | All clickable actions (variants: primary, secondary, ghost, danger, icon, toggle) |
| `Input`    | Text inputs with label, error, and helper text support                            |
| `Textarea` | Multi-line text inputs                                                            |
| `Select`   | Dropdowns (SelectTrigger, SelectContent, SelectItem)                              |
| `Card`     | Content containers (CardHeader, CardTitle, CardDescription, CardContent)          |
| `Badge`    | Status indicators (variants: default, primary, success, warning, error, info)     |
| `Tabs`     | Tab navigation (TabsList, TabsTrigger, TabsContent)                               |
| `Dialog`   | Modals (DialogTrigger, DialogContent, DialogHeader, DialogFooter)                 |
| `Toast`    | Notifications via `useToast()` hook                                               |
| `Tooltip`  | Hover information (TooltipTrigger, TooltipContent)                                |
| `Toggle`   | Toggle buttons with pressed state                                                 |

### Usage Example

```tsx
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
} from '../components/ui';

const styles = {
  badge: 'mr-2',
} as const;

const MyComponent = () => (
  <Card>
    <CardHeader>
      <CardTitle>Title</CardTitle>
    </CardHeader>
    <CardContent>
      <Badge variant="success" className={styles.badge}>
        Active
      </Badge>
      <Button variant="primary">Submit</Button>
    </CardContent>
  </Card>
);
```

### Adding New Components

1. **Check Radix UI Primitives first**: https://www.radix-ui.com/primitives/docs/overview/introduction
2. If it exists in Radix, create a wrapper in `src/components/ui/`
3. Style with Tailwind using CVA (class-variance-authority) for variants
4. Export from `src/components/ui/index.ts`
5. Add examples to `UIComponentsShowcase.tsx`

## Icons

Use **Lucide React** for all icons: https://lucide.dev/icons/

```tsx
import { Home, Settings, AlertTriangle } from 'lucide-react';

const styles = {
  icon: {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  },
} as const;

<Home className={styles.icon.md} />;
```

### Standard Sizes

| Size | Classes   | Usage                       |
| ---- | --------- | --------------------------- |
| sm   | `h-4 w-4` | Inline with text, buttons   |
| md   | `h-5 w-5` | Default icon size           |
| lg   | `h-6 w-6` | Headers, prominent areas    |
| xl   | `h-8 w-8` | Card headers, hero sections |

### Icons in Buttons

```tsx
<Button icon={<Rocket className={styles.icon.sm} />}>Deploy</Button>

// Icon-only button
<Button variant="icon" size="icon">
  <Copy className={styles.icon.sm} />
</Button>
```

**Do NOT use**: Emojis, inline SVGs, or other icon libraries.

## Hooks

| Hook         | Purpose                                                           |
| ------------ | ----------------------------------------------------------------- |
| `useToast()` | Show toast notifications (success, error, warning, info, loading) |
| `useModal()` | Manage modal state with `MODAL_IDS`                               |
| `useTheme()` | Access and toggle light/dark theme                                |

### Toast Examples

```tsx
const { success, error, warning, info, loading } = useToast();

// Simple toast
success('Operation completed');

// With description
error('Failed', 'Check console for details');

// Loading toast that resolves
const toast = loading('Processing...', 'Please wait');
// Later...
toast.success('Done!', 'Operation completed');
// or
toast.error('Failed', 'Something went wrong');
```

## Component Structure

1. **Imports**: React → Third-party → Internal
2. **Styles object**: Define all Tailwind classes
3. **Types/Interfaces**: Component props
4. **Component function**: Keep render logic simple
5. **Export**: Named exports preferred

## Best Practices

- Use logical AND (`&&`) over ternary for conditional rendering
- Keep components focused and single-purpose
- Use hooks for side effects and state management
- Implement proper memoization (`useMemo`, `useCallback`)
- Keep state as local as possible
- Always cleanup effects with return functions
- Import only what you need (tree-shaking)

## Common Commands

```bash
# Development
yarn dev

# Build
yarn build

# Type check
yarn typecheck

# Lint
yarn lint
```

## File Structure

```
src/
├── components/
│   ├── ui/              # Primitive UI components (Button, Input, etc.)
│   └── ...              # Feature components
├── containers/          # Page-level components
├── hooks/               # Custom React hooks
├── providers/           # Context providers
├── styles/
│   ├── globals.css      # Global styles & Tailwind config
│   └── theme.ts         # CVA variants for components
└── utils/               # Utility functions (cn, etc.)
```
