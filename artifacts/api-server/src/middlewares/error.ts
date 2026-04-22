import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }

  if (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "JsonWebTokenError"
  ) {
    return res.status(401).json({ success: false, error: "Invalid token" });
  }

  if (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "TokenExpiredError"
  ) {
    return res.status(401).json({ success: false, error: "Token expired" });
  }

  logger.error({ err }, "Unhandled error");

  return res.status(500).json({
    success: false,
    error: "Internal server error",
  });
}
