// App-level config. Single source of truth for identity, node URL, and timing.

/** App identity used in wallet-sdk handshakes and capability manifests. */
export const APP_ID = "web-boiler";

/** Default Aztec testnet RPC; override with VITE_AZTEC_NODE_URL in your .env. */
export const DEFAULT_NODE_URL = "https://rpc.testnet.aztec-labs.com";

// `||` (not `??`) so a present-but-blank env var also falls back to the default.
/** Resolved node URL: the env var if set, otherwise the testnet default. */
export const NODE_URL =
  (import.meta.env.VITE_AZTEC_NODE_URL as string | undefined) ||
  DEFAULT_NODE_URL;

/** How long wallet discovery waits before giving up (ms). */
export const DISCOVERY_TIMEOUT_MS = 30_000;

/** A selectable Aztec network (node RPC the app talks to). */
export interface NetworkConfig {
  id: string;
  label: string;
  nodeUrl: string;
}

// NOTE: keep these in sync with the app's pinned @aztec/* version.
export const NETWORKS: NetworkConfig[] = [
  { id: "testnet", label: "Testnet", nodeUrl: NODE_URL },
  { id: "localhost", label: "Localhost", nodeUrl: "http://localhost:8080" },
];

export const DEFAULT_NETWORK_ID = "testnet";

/** Look up a network by id, falling back to the first one. */
export function getNetwork(id: string): NetworkConfig {
  return NETWORKS.find((n) => n.id === id) ?? NETWORKS[0];
}
