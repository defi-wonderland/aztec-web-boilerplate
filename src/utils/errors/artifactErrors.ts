/**
 * Error codes for contract-related operations.
 * Using const assertion for type safety and autocomplete.
 */
export const ArtifactErrorCode = {
  // Artifact parsing errors
  ARTIFACT_PARSE_FAILED: 'ARTIFACT_PARSE_FAILED',
  ARTIFACT_INVALID_JSON: 'ARTIFACT_INVALID_JSON',
  ARTIFACT_INVALID_STRUCTURE: 'ARTIFACT_INVALID_STRUCTURE',
  ARTIFACT_MISSING_FUNCTIONS: 'ARTIFACT_MISSING_FUNCTIONS',

  // Artifact fetching errors
  ARTIFACT_NOT_FOUND: 'ARTIFACT_NOT_FOUND',
  ARTIFACT_FETCH_FAILED: 'ARTIFACT_FETCH_FAILED',
  ARTIFACT_FETCH_TIMEOUT: 'ARTIFACT_FETCH_TIMEOUT',

  // Artifact validation errors
  ARTIFACT_CLASS_ID_MISMATCH: 'ARTIFACT_CLASS_ID_MISMATCH',
  ARTIFACT_TOO_LARGE: 'ARTIFACT_TOO_LARGE',
} as const;

export type ArtifactErrorCode =
  (typeof ArtifactErrorCode)[keyof typeof ArtifactErrorCode];

/**
 * Base error class for all contract-related operations.
 * Follows the same pattern as WalletServiceError for consistency.
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

  /**
   * Returns the user-friendly error message.
   */
  get userMessage(): string {
    return this.message;
  }

  /**
   * Creates a ArtifactError from an unknown error.
   */
  static from(
    err: unknown,
    code: ArtifactErrorCode,
    fallbackMessage: string
  ): ArtifactError {
    const message = err instanceof Error ? err.message : fallbackMessage;
    return new ArtifactError(message, code, err);
  }
}

/**
 * Error thrown when artifact JSON parsing fails.
 */
export class ArtifactParseError extends ArtifactError {
  constructor(message: string, cause?: unknown) {
    super(message, ArtifactErrorCode.ARTIFACT_PARSE_FAILED, cause, false);
    this.name = 'ArtifactParseError';
    Object.setPrototypeOf(this, ArtifactParseError.prototype);
  }

  static invalidJson(cause?: unknown): ArtifactParseError {
    return new ArtifactParseError(
      'Invalid artifact: expected valid JSON',
      cause
    );
  }

  static invalidStructure(detail?: string): ArtifactParseError {
    const message = detail
      ? `Invalid artifact structure: ${detail}`
      : 'Invalid artifact: expected JSON object';
    return new ArtifactParseError(message);
  }

  static missingFunctions(): ArtifactParseError {
    return new ArtifactParseError('Invalid artifact: missing functions array');
  }
}

/**
 * Error thrown when fetching artifact from registry fails.
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
      (statusCode !== undefined && statusCode >= 500);
    super(message, code, cause, isRetriable);
    this.name = 'ArtifactFetchError';
    Object.setPrototypeOf(this, ArtifactFetchError.prototype);
  }

  static notFound(classId: string): ArtifactFetchError {
    return new ArtifactFetchError(
      `Artifact not found for classId: ${classId}`,
      ArtifactErrorCode.ARTIFACT_NOT_FOUND,
      404
    );
  }

  static fetchFailed(
    statusCode: number,
    statusText: string
  ): ArtifactFetchError {
    return new ArtifactFetchError(
      `Failed to fetch artifact from registry: ${statusCode} ${statusText}`,
      ArtifactErrorCode.ARTIFACT_FETCH_FAILED,
      statusCode
    );
  }

  static timeout(classId: string): ArtifactFetchError {
    return new ArtifactFetchError(
      `Timeout fetching artifact for classId: ${classId}`,
      ArtifactErrorCode.ARTIFACT_FETCH_TIMEOUT
    );
  }
}

/**
 * Error thrown when artifact validation fails.
 */
export class ArtifactValidationError extends ArtifactError {
  constructor(
    message: string,
    code: ArtifactErrorCode = ArtifactErrorCode.ARTIFACT_INVALID_STRUCTURE,
    public readonly expectedValue?: string,
    public readonly actualValue?: string
  ) {
    super(message, code, undefined, false);
    this.name = 'ArtifactValidationError';
    Object.setPrototypeOf(this, ArtifactValidationError.prototype);
  }

  static classIdMismatch(
    expected: string,
    actual: string
  ): ArtifactValidationError {
    return new ArtifactValidationError(
      `Artifact classId mismatch: expected ${expected}, got ${actual}`,
      ArtifactErrorCode.ARTIFACT_CLASS_ID_MISMATCH,
      expected,
      actual
    );
  }

  static tooLarge(size: number, maxSize: number): ArtifactValidationError {
    return new ArtifactValidationError(
      `Artifact too large: ${size} chars (max: ${maxSize})`,
      ArtifactErrorCode.ARTIFACT_TOO_LARGE,
      String(maxSize),
      String(size)
    );
  }
}

/**
 * Type guard to check if an error is a ArtifactError.
 */
export const isArtifactError = (err: unknown): err is ArtifactError =>
  err instanceof ArtifactError;

/**
 * Type guard to check if an error is an ArtifactParseError.
 */
export const isArtifactParseError = (err: unknown): err is ArtifactParseError =>
  err instanceof ArtifactParseError;

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
