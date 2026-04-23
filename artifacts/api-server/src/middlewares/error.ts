import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

// Extract the root cause of a Drizzle-wrapped error (or return the error itself)
function getRootCause(err: unknown): unknown {
  if (typeof err === "object" && err !== null && "cause" in err) {
    return (err as { cause: unknown }).cause ?? err;
  }
  return err;
}

// Map postgres error code to a human-readable message
function postgresMessage(code: string, message: string): string | null {
  switch (code) {
    case "23503": {
      // foreign_key_violation — extract the constraint name for a better hint
      const match = message.match(/constraint "([^"]+)"/);
      const hint = match ? ` (${match[1]})` : "";
      return `Invalid reference: a related record does not exist${hint}`;
    }
    case "23505": {
      const match = message.match(/Key \(([^)]+)\)/);
      const field = match ? ` on field "${match[1]}"` : "";
      return `A record with that value already exists${field}`;
    }
    case "23502": {
      const match = message.match(/column "([^"]+)"/);
      const field = match ? ` "${match[1]}"` : "";
      return `Required field${field} is missing`;
    }
    case "22P02":
      return "Invalid data format — check that numeric fields contain numbers";
    default:
      return null;
  }
}

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

  // Handle PostgreSQL errors (both direct and Drizzle-wrapped)
  const cause = getRootCause(err);
  if (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    typeof (cause as { code: unknown }).code === "string"
  ) {
    const pgCode = (cause as { code: string; message?: string }).code;
    const pgMsg = (cause as { message?: string }).message ?? "";
    const friendly = postgresMessage(pgCode, pgMsg);
    if (friendly) {
      return res.status(400).json({ success: false, error: friendly, code: pgCode });
    }
  }

  logger.error({ err }, "Unhandled error");

  return res.status(500).json({
    success: false,
    error: "Internal server error",
  });
}
