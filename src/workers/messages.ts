export type DeployEcdsaAccountPayload = {
  nodeUrl: string;
  secretKey: string;
  signingKeyHex: string;
  salt: string;
};

export type DeployEcdsaAccountMessage = {
  type: 'deployEcdsaAccount';
  payload: DeployEcdsaAccountPayload;
};

export type DeploySuccess = {
  type: 'deployed';
  payload: { status: string; txHash: string | null };
};

export type WorkerError = {
  type: 'error';
  error: string;
};

export type WorkerRequest = DeployEcdsaAccountMessage;
export type WorkerResponse = DeploySuccess | WorkerError;


