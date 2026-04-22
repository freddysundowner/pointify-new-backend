import jwt from "jsonwebtoken";

const SECRET = process.env["SESSION_SECRET"] ?? "dev-secret-change-me";

export type AdminPayload = {
  role: "admin";
  id: number;
  isSuperAdmin: boolean;
};

export type AttendantPayload = {
  role: "attendant";
  id: number;
  shopId: number;
};

export type CustomerPayload = {
  role: "customer";
  id: number;
};

export type AffiliatePayload = {
  role: "affiliate";
  id: number;
};

export type TokenPayload =
  | AdminPayload
  | AttendantPayload
  | CustomerPayload
  | AffiliatePayload;

export function signToken(payload: TokenPayload, expiresIn = "30d"): string {
  return jwt.sign(payload, SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}

export function extractBearer(header?: string): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}
