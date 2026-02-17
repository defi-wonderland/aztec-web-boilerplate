/**
 * Error codes for artifact-related operations.
 */
export const ArtifactErrorCode = {
  // Parsing errors
  ARTIFACT_PARSE_FAILED: 'ARTIFACT_PARSE_FAILED',
  ARTIFACT_INVALID_JSON: 'ARTIFACT_INVALID_JSON',
  ARTIFACT_INVALID_STRUCTURE: 'ARTIFACT_INVALID_STRUCTURE',
  ARTIFACT_MISSING_FUNCTIONS: 'ARTIFACT_MISSING_FUNCTIONS',

  // Fetch errors
  ARTIFACT_NOT_FOUND: 'ARTIFACT_NOT_FOUND',
  ARTIFACT_FETCH_FAILED: 'ARTIFACT_FETCH_FAILED',
  ARTIFACT_FETCH_TIMEOUT: 'ARTIFACT_FETCH_TIMEOUT',

  // External/tgz errors
  ARTIFACT_TGZ_FETCH_FAILED: 'ARTIFACT_TGZ_FETCH_FAILED',
  ARTIFACT_TGZ_EXTRACT_FAILED: 'ARTIFACT_TGZ_EXTRACT_FAILED',
  ARTIFACT_CONTRACT_NOT_IN_PACKAGE: 'ARTIFACT_CONTRACT_NOT_IN_PACKAGE',

  // Validation errors
  ARTIFACT_CLASS_ID_MISMATCH: 'ARTIFACT_CLASS_ID_MISMATCH',
  ARTIFACT_TOO_LARGE: 'ARTIFACT_TOO_LARGE',
} as const;

export type ArtifactErrorCode =
  (typeof ArtifactErrorCode)[keyof typeof ArtifactErrorCode];

/**
 * Base error class for all artifact-related operations.
 */
export class ArtifactError extends Error {
  constructor(
    message: string,
    public readonly code: ArtifactErrorCode,
    public readonly cause?: unknown,
    public readonly retriable: boolean = false
  ) {
    super(message);
    this.name = 'ArtifactError';
    Object.setPrototypeOf(this, ArtifactError.prototype);
  }

  get userMessage(): string {
    return this.message;
  }
}

/**
 * Error for HTTP fetch operations. Extends ArtifactError with statusCode.
 */
export class ArtifactFetchError extends ArtifactError {
  constructor(
    message: string,
    code: ArtifactErrorCode = ArtifactErrorCode.ARTIFACT_FETCH_FAILED,
    public readonly statusCode?: number,
    cause?: unknown
  ) {
    const isRetriable =
      code === ArtifactErrorCode.ARTIFACT_FETCH_TIMEOUT ||
      code === ArtifactErrorCode.ARTIFACT_TGZ_FETCH_FAILED ||
      (statusCode !== undefined && statusCode >= 500);
    super(message, code, cause, isRetriable);
    this.name = 'ArtifactFetchError';
    Object.setPrototypeOf(this, ArtifactFetchError.prototype);
  }
}

/**
 * Factory for creating artifact errors with predefined messages.
 */
export const ArtifactErrorFactory = {
  // Parse errors
  invalidJson: (cause?: unknown): ArtifactError =>
    new ArtifactError(
      'Invalid artifact: expected valid JSON',
      ArtifactErrorCode.ARTIFACT_INVALID_JSON,
      cause
    ),

  invalidStructure: (detail?: string): ArtifactError =>
    new ArtifactError(
      detail
        ? `Invalid artifact structure: ${detail}`
        : 'Invalid artifact: expected JSON object',
      ArtifactErrorCode.ARTIFACT_INVALID_STRUCTURE
    ),

  missingFunctions: (): ArtifactError =>
    new ArtifactError(
      'Invalid artifact: missing functions array',
      ArtifactErrorCode.ARTIFACT_MISSING_FUNCTIONS
    ),

  // Fetch errors
  notFound: (classId: string): ArtifactFetchError =>
    new ArtifactFetchError(
      `Artifact not found for classId: ${classId}`,
      ArtifactErrorCode.ARTIFACT_NOT_FOUND,
      404
    ),

  fetchFailed: (statusCode: number, statusText: string): ArtifactFetchError =>
    new ArtifactFetchError(
      `Failed to fetch artifact from registry: ${statusCode} ${statusText}`,
      ArtifactErrorCode.ARTIFACT_FETCH_FAILED,
      statusCode
    ),

  timeout: (classId: string): ArtifactFetchError =>
    new ArtifactFetchError(
      `Timeout fetching artifact for classId: ${classId}`,
      ArtifactErrorCode.ARTIFACT_FETCH_TIMEOUT
    ),

  // External/tgz errors
  tgzFetchFailed: (url: string, cause?: unknown): ArtifactFetchError =>
    new ArtifactFetchError(
      `Failed to fetch artifact package from: ${url}`,
      ArtifactErrorCode.ARTIFACT_TGZ_FETCH_FAILED,
      undefined,
      cause
    ),

  tgzExtractFailed: (url: string, cause?: unknown): ArtifactError =>
    new ArtifactError(
      `Failed to extract artifact package from: ${url}`,
      ArtifactErrorCode.ARTIFACT_TGZ_EXTRACT_FAILED,
      cause
    ),

  contractNotInPackage: (contractName: string, url: string): ArtifactError =>
    new ArtifactError(
      `Contract "${contractName}" not found in package: ${url}`,
      ArtifactErrorCode.ARTIFACT_CONTRACT_NOT_IN_PACKAGE
    ),

  // Validation errors
  classIdMismatch: (expected: string, actual: string): ArtifactError =>
    new ArtifactError(
      `Artifact classId mismatch: expected ${expected}, got ${actual}`,
      ArtifactErrorCode.ARTIFACT_CLASS_ID_MISMATCH
    ),

  tooLarge: (size: number, maxSize: number): ArtifactError =>
    new ArtifactError(
      `Artifact too large: ${size} chars (max: ${maxSize})`,
      ArtifactErrorCode.ARTIFACT_TOO_LARGE
    ),

  // Generic factory
  from: (
    err: unknown,
    code: ArtifactErrorCode,
    fallbackMessage: string
  ): ArtifactError => {
    const message = err instanceof Error ? err.message : fallbackMessage;
    return new ArtifactError(message, code, err);
  },
} as const;

/**
 * Type guard to check if an error is an ArtifactError.
 */
export const isArtifactError = (err: unknown): err is ArtifactError =>
  err instanceof ArtifactError;

/**
 * Type guard to check if an error is an ArtifactFetchError.
 */
export const isArtifactFetchError = (err: unknown): err is ArtifactFetchError =>
  err instanceof ArtifactFetchError;

/**
 * Extracts a user-friendly message from any error.
 */
export const getErrorMessage = (
  err: unknown,
  fallback = 'An unexpected error occurred'
): string => {
  if (isArtifactError(err)) {
    return err.userMessage;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
};
