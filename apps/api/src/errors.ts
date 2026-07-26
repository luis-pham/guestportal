export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function toErrorBody(error: ApiError, requestId: string): ApiErrorBody {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      requestId,
    },
  };
  if (error.details) {
    body.error.details = error.details;
  }
  return body;
}
