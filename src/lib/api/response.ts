import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Standard error codes used across all API responses.
 */
export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION: "VALIDATION",
  CONFLICT: "CONFLICT",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  TIMEOUT: "TIMEOUT",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  VALIDATION: 422,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
  METHOD_NOT_ALLOWED: 405,
  TIMEOUT: 504,
};

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export interface ApiPaginated<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  timestamp: string;
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Build a successful JSON response.
 */
export function success<T>(data: T, init?: ResponseInit & { meta?: Record<string, unknown> }): NextResponse {
  const { meta, headers, ...rest } = init ?? {};
  const body: ApiSuccess<T> = {
    success: true,
    data,
    timestamp: now(),
  };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { ...rest, headers });
}

/**
 * Build a structured error response. If `code` is omitted, the HTTP status is
 * used to pick a sensible default code.
 */
export function error(
  message: string,
  status: number = 500,
  code?: ErrorCode,
  details?: unknown,
): NextResponse {
  const resolvedCode: ErrorCode =
    code ??
    (Object.entries(ERROR_STATUS_MAP).find(([, s]) => s === status)?.[0] as ErrorCode | undefined) ??
    ERROR_CODES.INTERNAL;
  const body: ApiError = {
    success: false,
    error: { code: resolvedCode, message, ...(details !== undefined ? { details } : {}) },
    timestamp: now(),
  };
  return NextResponse.json(body, { status });
}

/**
 * Build a response for Zod validation errors.
 */
export function validationError(zodError: ZodError): NextResponse {
  return error("Validation failed", ERROR_STATUS_MAP.VALIDATION, ERROR_CODES.VALIDATION, {
    fieldErrors: zodError.flatten().fieldErrors,
    formErrors: zodError.flatten().formErrors,
  });
}

/**
 * Build a paginated response envelope.
 */
export function paginated<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
  init?: ResponseInit,
): NextResponse {
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const body: ApiPaginated<T> = {
    success: true,
    data: items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    timestamp: now(),
  };
  return NextResponse.json(body, init);
}

/**
 * Convenience helpers for common error responses.
 */
export const errors = {
  unauthorized: (message = "Authentication required") =>
    error(message, 401, ERROR_CODES.UNAUTHORIZED),
  forbidden: (message = "Insufficient permissions") =>
    error(message, 403, ERROR_CODES.FORBIDDEN),
  notFound: (message = "Resource not found") =>
    error(message, 404, ERROR_CODES.NOT_FOUND),
  badRequest: (message = "Bad request") =>
    error(message, 400, ERROR_CODES.BAD_REQUEST),
  methodNotAllowed: (allowed: string[]) =>
    error(`Method not allowed. Allowed: ${allowed.join(", ")}`, 405, ERROR_CODES.METHOD_NOT_ALLOWED),
  payloadTooLarge: (message = "Payload too large") =>
    error(message, 413, ERROR_CODES.PAYLOAD_TOO_LARGE),
  rateLimited: (retryAfter?: number) =>
    error("Too many requests", 429, ERROR_CODES.RATE_LIMITED, { retryAfter }),
  internal: (message = "Internal server error") =>
    error(message, 500, ERROR_CODES.INTERNAL),
  serviceUnavailable: (message = "Service unavailable") =>
    error(message, 503, ERROR_CODES.SERVICE_UNAVAILABLE),
};

export { ERROR_STATUS_MAP };
