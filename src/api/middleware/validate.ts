import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

type Target = "body" | "query" | "params";

/**
 * Validates and replaces req[target] with the parsed (and coerced) data.
 * Throws a ZodError on failure, which the centralized error handler turns
 * into a clean 400 response - routes never hand-roll validation.
 */
export function validate(schema: ZodSchema, target: Target = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    req[target] = schema.parse(req[target]);
    next();
  };
}
