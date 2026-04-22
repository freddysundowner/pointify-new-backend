/**
 * Receipt token helpers — generate an unguessable short token from a sale id
 * using HMAC-SHA256, and verify it on incoming requests so customers can view
 * their receipt without authentication.
 */
import crypto from "node:crypto";

const SECRET =
  process.env["RECEIPT_TOKEN_SECRET"] ??
  process.env["SESSION_SECRET"] ??
  process.env["JWT_SECRET"] ??
  "pointify-receipt-fallback-secret-change-me";

/** Generate a short URL-safe token for a sale id. */
export function makeReceiptToken(saleId: number): string {
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(`sale:${saleId}`)
    .digest("base64url")
    .slice(0, 12);
  // Encode the sale id alongside the signature so we don't need a DB lookup
  // to map token → sale id.
  const idPart = Buffer.from(String(saleId)).toString("base64url");
  return `${idPart}.${sig}`;
}

/** Decode a token and verify its signature. Returns saleId on success. */
export function verifyReceiptToken(token: string): number | null {
  if (!token || !token.includes(".")) return null;
  const [idPart, sig] = token.split(".");
  if (!idPart || !sig) return null;
  let saleId: number;
  try {
    saleId = Number(Buffer.from(idPart, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!Number.isInteger(saleId) || saleId <= 0) return null;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`sale:${saleId}`)
    .digest("base64url")
    .slice(0, 12);
  // Constant-time compare
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? saleId : null;
}

/** Build the public URL a customer can click to view a receipt. */
export function buildReceiptUrl(saleId: number): string {
  const base =
    process.env["PUBLIC_API_URL"] ??
    process.env["REPLIT_DEV_DOMAIN"]
      ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
      : "https://api.pointifypos.com";
  const token = makeReceiptToken(saleId);
  return `${base.replace(/\/$/, "")}/api/r/${token}`;
}
