/**
 * Custom error types for improved error handling
 */

export class ObsidianMCPError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ObsidianMCPError';
    Object.setPrototypeOf(this, ObsidianMCPError.prototype);
  }
}

export class FileNotFoundError extends ObsidianMCPError {
  constructor(path: string, details?: unknown) {
    super(`File not found: ${path}`, 'FILE_NOT_FOUND', details);
    this.name = 'FileNotFoundError';
  }
}

export class InvalidPathError extends ObsidianMCPError {
  constructor(path: string, reason: string, details?: unknown) {
    super(`Invalid path "${path}": ${reason}`, 'INVALID_PATH', details);
    this.name = 'InvalidPathError';
  }
}

export class ParseError extends ObsidianMCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'PARSE_ERROR', details);
    this.name = 'ParseError';
  }
}

export class CacheError extends ObsidianMCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'CACHE_ERROR', details);
    this.name = 'CacheError';
  }
}

export class ValidationError extends ObsidianMCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class PermissionError extends ObsidianMCPError {
  constructor(path: string, operation: string, details?: unknown) {
    super(`Permission denied for ${operation} on ${path}`, 'PERMISSION_ERROR', details);
    this.name = 'PermissionError';
  }
}

export class QuotaExceededError extends ObsidianMCPError {
  constructor(resource: string, limit: number, details?: unknown) {
    super(`Quota exceeded for ${resource}. Limit: ${limit}`, 'QUOTA_EXCEEDED', details);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Type guard for ObsidianMCPError
 */
export function isObsidianMCPError(error: unknown): error is ObsidianMCPError {
  return error instanceof ObsidianMCPError;
}

/**
 * Safe error message extraction
 */
export function getErrorMessage(error: unknown): string {
  if (isObsidianMCPError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Create structured error response
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: string;
    [key: string]: unknown;
  };
}

export function createErrorResponse(error: unknown): ErrorResponse {
  const timestamp = new Date().toISOString();

  if (isObsidianMCPError(error)) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      metadata: { timestamp }
    };
  }

  return {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: getErrorMessage(error)
    },
    metadata: { timestamp }
  };
}