import type { SecureChannel } from '../shared/SecureChannel';

export class PXEProxy {
  constructor(private channel: SecureChannel) {}

  async call(method: string, params: unknown[]): Promise<unknown> {
    return this.channel.send(method, params);
  }

  /** Creates a Proxy that forwards all method calls through the channel. */
  createInterface<T extends object>(): T {
    return new Proxy({} as T, {
      get: (_target, prop: string) => {
        if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
        return (...args: unknown[]) => this.call(prop, args);
      },
    });
  }
}
