export class AztecClientNotReadyError extends Error {
  constructor() {
    super('Aztec execution client is not ready');
    this.name = 'AztecClientNotReadyError';
  }
}
