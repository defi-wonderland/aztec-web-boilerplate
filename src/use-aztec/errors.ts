export class AztecClientNotReady extends Error {
  constructor() {
    super('Aztec execution client is not ready');
    this.name = 'AztecClientNotReady';
  }
}
