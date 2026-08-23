import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../../utils/logger";

export class ApiError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super(404, message);
  }
}

/** Wraps async route handlers so rejected promises reach the error middleware instead of crashing the process. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const requestId = res.getHeader("x-request-id");

  if (err instanceof ZodError) {
    logger.warn({ requestId, issues: err.issues }, "validation error");
    res.status(400).json({
      error: "ValidationError",
      message: "Request failed validation",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }

  if (err instanceof ApiError) {
    logger.warn({ requestId, statusCode: err.statusCode, message: err.message }, "api error");
    res.status(err.statusCode).json({ error: err.name, message: err.message, details: err.details });
    return;
  }

  logger.error({ requestId, err: err instanceof Error ? err.stack : String(err) }, "unhandled error");
  res.status(500).json({ error: "InternalServerError", message: "Something went wrong" });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: "NotFound", message: `No route for ${req.method} ${req.path}` });
}
