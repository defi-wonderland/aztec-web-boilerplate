import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettierPlugin from 'eslint-plugin-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Ignored paths: build output and auto-generated contract artifacts
  {
    ignores: [
      'dist',
      'src/artifacts/**',
      'src/target/**',
      '**/eslint.config.js',
    ],
  },
  // Prettier config disables ESLint rules that conflict with Prettier formatting
  prettierConfig,
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    files: ['**/*.{ts,tsx,jsx,js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      prettier: prettierPlugin,
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      // React Hooks rules (rules-of-hooks, exhaustive-deps)
      ...reactHooks.configs.recommended.rules,

      // Vite HMR: warns when exports may break fast refresh
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // Import ordering: enforces consistent import structure
      'import/order': [
        'error',
        {
          'newlines-between': 'never',
          alphabetize: {
            order: 'asc',
            caseInsensitive: false,
          },
          groups: [
            'external',
            'builtin',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
            'unknown',
          ],
          pathGroups: [
            {
              pattern: 'react',
              group: 'external',
              position: 'before',
            },
            {
              pattern: 'react-dom',
              group: 'external',
              position: 'before',
            },
            {
              pattern: '@aztec/**',
              group: 'external',
              position: 'after',
            },
          ],
          pathGroupsExcludedImportTypes: ['react'],
        },
      ],

      // Prettier integration: shows formatting errors as ESLint errors
      'prettier/prettier': 'error',

      // TypeScript rules
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],

      // Disabled: Using eslint-plugin-unused-imports instead for auto-fix support
      '@typescript-eslint/no-unused-vars': 'off',

      // Auto-fixable: Removes unused imports on `yarn lint:fix`
      'unused-imports/no-unused-imports': 'error',

      // Reports unused variables (not auto-fixable)
      // Allows underscore prefix for intentionally unused vars (e.g., _unused)
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // Accessibility: Relaxed for labels used as visual grouping (not form controls)
      'jsx-a11y/label-has-associated-control': 'off',
      // Accessibility: Allow click on divs for modals/overlays (with proper aria attributes)
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  }
);
