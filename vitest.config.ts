import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  
  test: {
    // Test environment
    environment: 'node',
    
    // Global test setup
    globals: true,
    
    // Test file patterns
    include: [
      'tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      '.git',
      '.cache',
      'tests/e2e/**/*'
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**'
      ]
    },
    
    // Test timeout (longer for Aztec operations)
    testTimeout: 30000,
    
    // Reporter configuration
    reporters: ['verbose'],
    
    // Watch mode configuration
    watch: false,
    
    // Parallel execution
    pool: 'threads',
    
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    
    // Setup files
    setupFiles: ['./tests/setup.ts']
  },
  
  // Resolve configuration for imports
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
  
  // Define global variables for tests
  define: {
    global: 'globalThis',
    __TEST__: true
  },
});
