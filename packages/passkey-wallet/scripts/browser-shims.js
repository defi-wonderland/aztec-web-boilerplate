import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
globalThis.process = globalThis.process || { env: { NODE_ENV: 'production' }, browser: true, nextTick: fn => setTimeout(fn, 0), versions: {} };
globalThis.global = globalThis;
