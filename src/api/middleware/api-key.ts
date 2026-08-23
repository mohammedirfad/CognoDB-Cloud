import { NextFunction, Request, Response } from "express";
import { env } from "../../config/env";
import { ApiError } from "./error-handler";

/**
 * Simple shared-secret guard for endpoints that trigger real work (starting
 * a benchmark run hits real cloud databases and costs time/quota). Read-only
 * endpoints stay open; anything that mutates state requires `x-api-key`.
 */
export function requireApiKey(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.header("x-api-key");
  if (!provided || provided !== env.API_KEY) {
    throw new ApiError(401, "Missing or invalid x-api-key header");
  }
  next();
}
