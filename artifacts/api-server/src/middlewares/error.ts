import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRootCause(err: unknown): unknown {
  if (typeof err === "object" && err !== null && "cause" in err) {
    return (err as { cause: unknown }).cause ?? err;
  }
  return err;
}

// "product_category_id" → "Product category"
// "supplier_id"         → "Supplier"
// "email"               → "Email"
function toLabel(snakeCase: string): string {
  const label = snakeCase.replace(/_id$/, "").replace(/_/g, " ").toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Parse Postgres FK detail: "Key (col)=(val) is not present in table "tbl"."
function parseFkDetail(detail: string): string {
  const m = detail.match(/Key \(([^)]+)\)=\(([^)]*)\) is not present in table "([^"]+)"/);
  if (m) {
    const [, field, value] = m;
    return `${toLabel(field)} "${value}" not found`;
  }
  return "A required related record does not exist";
}

// Parse Postgres unique detail: "Key (col)=(val) already exists."
function parseUniqueDetail(detail: string): string {
  const m = detail.match(/Key \(([^)]+)\)=\(([^)]*)\) already exists/);
  if (m) {
    const [, field, value] = m;
    return `${toLabel(field)} "${value}" already exists`;
  }
  return "A record with that value already exists";
}

// Parse not-null detail: "Failing row contains (... null ...)."
// Postgres message for 23502 is: 'null value in column "col" of relation "tbl" violates not-null constraint'
function parseNotNullMessage(message: string): string {
  const m = message.match(/null value in column "([^"]+)"/);
  if (m) return `${toLabel(m[1])} is required`;
  return "A required field is missing";
}

interface PgError {
  code: string;
  message?: string;
  detail?: string;
}

function isPgError(e: unknown): e is PgError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string"
  );
}

function handlePgError(pg: PgError): { status: number; message: string } | null {
  const detail = pg.detail ?? "";
  const message = pg.message ?? "";

  switch (pg.code) {
    case "23503":
      return { status: 400, message: parseFkDetail(detail) };
    case "23505":
      return { status: 409, message: parseUniqueDetail(detail) };
    case "23502":
      return { status: 400, message: parseNotNullMessage(message) };
    case "22P02":
      return { status: 400, message: "Invalid value — check that number fields contain numbers" };
    case "22001":
      return { status: 400, message: "A value is too long for its field" };
    case "42703":
      return { status: 400, message: "Unknown field in query" };
    default:
      return null;
  }
}

// ── Middleware ─────────────────────────────────────────────────────────────────

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

  // Handle PostgreSQL errors — check both the error itself and its cause
  // (Drizzle wraps pg errors via `cause`)
  for (const candidate of [err, getRootCause(err)]) {
    if (isPgError(candidate)) {
      const handled = handlePgError(candidate);
      if (handled) {
        return res.status(handled.status).json({
          success: false,
          error: handled.message,
        });
      }
    }
  }

  logger.error({ err }, "Unhandled error");

  return res.status(500).json({
    success: false,
    error: "Internal server error",
  });
}
