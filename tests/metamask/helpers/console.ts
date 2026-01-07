/**
 * Console log capture utilities for Playwright tests
 *
 * Provides Selenium-like browser console log access in Playwright via page.on('console')
 */

import type { Page, ConsoleMessage } from '@playwright/test';

export interface ConsoleLogs {
  all: string[];
  errors: string[];
  warnings: string[];
  info: string[];
  debug: string[];
}

export interface ConsoleCapture {
  /** Get all captured logs organized by type */
  getLogs: () => ConsoleLogs;
  /** Clear all captured logs */
  clear: () => void;
  /** Get raw ConsoleMessage objects */
  getRawLogs: () => ConsoleMessage[];
  /** Print all logs to stdout for debugging */
  dump: () => void;
}

/**
 * Create a console capture instance for a page
 *
 * Usage:
 * ```ts
 * const capture = createConsoleCapture(page);
 * // ... do things ...
 * const logs = capture.getLogs();
 * console.log('Errors:', logs.errors);
 * ```
 */
export function createConsoleCapture(page: Page): ConsoleCapture {
  const logs: ConsoleMessage[] = [];

  // Listen for console events
  page.on('console', (msg) => logs.push(msg));

  return {
    getLogs: () => ({
      all: logs.map((m) => formatLogEntry(m)),
      errors: logs.filter((m) => m.type() === 'error').map((m) => m.text()),
      warnings: logs.filter((m) => m.type() === 'warning').map((m) => m.text()),
      info: logs.filter((m) => m.type() === 'info').map((m) => m.text()),
      debug: logs.filter((m) => m.type() === 'debug').map((m) => m.text()),
    }),
    clear: () => {
      logs.length = 0;
    },
    getRawLogs: () => [...logs],
    dump: () => {
      console.log('\n=== Browser Console Logs ===');
      for (const log of logs) {
        console.log(formatLogEntry(log));
      }
      console.log('=== End Console Logs ===\n');
    },
  };
}

/**
 * Format a console message for display
 */
function formatLogEntry(msg: ConsoleMessage): string {
  const typeIndicator = getTypeIndicator(msg.type());
  return `${typeIndicator} ${msg.text()}`;
}

/**
 * Get a visual indicator for log type
 */
function getTypeIndicator(type: string): string {
  switch (type) {
    case 'error':
      return '[ERROR]';
    case 'warning':
      return '[WARN]';
    case 'info':
      return '[INFO]';
    case 'debug':
      return '[DEBUG]';
    case 'log':
      return '[LOG]';
    default:
      return `[${type.toUpperCase()}]`;
  }
}

/**
 * Assert that no console errors occurred (with optional allowlist)
 *
 * Usage:
 * ```ts
 * const logs = capture.getLogs();
 * assertNoConsoleErrors(logs, ['Expected error']);
 * ```
 */
export function assertNoConsoleErrors(
  logs: ConsoleLogs,
  allowList: string[] = []
): void {
  const filtered = logs.errors.filter(
    (e) => !allowList.some((allowed) => e.includes(allowed))
  );

  if (filtered.length > 0) {
    throw new Error(
      `Unexpected console errors detected:\n${filtered.map((e) => `  - ${e}`).join('\n')}`
    );
  }
}

/**
 * Wait for a specific console message to appear
 *
 * Usage:
 * ```ts
 * await waitForConsoleMessage(page, 'Account deployed');
 * ```
 */
export async function waitForConsoleMessage(
  page: Page,
  messagePattern: string | RegExp,
  timeout = 30000
): Promise<ConsoleMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      page.removeListener('console', handler);
      reject(
        new Error(
          `Timeout waiting for console message: ${messagePattern}`
        )
      );
    }, timeout);

    const handler = (msg: ConsoleMessage) => {
      const text = msg.text();
      const matches =
        typeof messagePattern === 'string'
          ? text.includes(messagePattern)
          : messagePattern.test(text);

      if (matches) {
        clearTimeout(timer);
        page.removeListener('console', handler);
        resolve(msg);
      }
    };

    page.on('console', handler);
  });
}
