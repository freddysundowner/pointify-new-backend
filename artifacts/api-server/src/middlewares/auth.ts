import type { Request, Response, NextFunction } from "express";
import { verifyToken, extractBearer } from "../lib/auth.js";
import { unauthorized, forbidden } from "../lib/errors.js";
import type {
  AdminPayload,
  AttendantPayload,
  CustomerPayload,
  AffiliatePayload,
} from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPayload;
      attendant?: AttendantPayload;
      customer?: CustomerPayload;
      affiliate?: AffiliatePayload;
    }
  }
}

function getToken(req: Request): string {
  const t = extractBearer(req.headers["authorization"]);
  if (!t) throw unauthorized("No bearer token provided");
  return t;
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const payload = verifyToken(getToken(req));
    if (payload.role !== "admin") throw forbidden("Admin access required");
    req.admin = payload;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireSuperAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const payload = verifyToken(getToken(req));
    if (payload.role !== "admin") throw forbidden("Admin access required");
    if (!payload.isSuperAdmin) throw forbidden("Super-admin access required");
    req.admin = payload;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAttendant(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const payload = verifyToken(getToken(req));
    if (payload.role !== "attendant") throw forbidden("Attendant access required");
    req.attendant = payload;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdminOrAttendant(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const payload = verifyToken(getToken(req));
    if (payload.role === "admin") req.admin = payload;
    else if (payload.role === "attendant") req.attendant = payload;
    else throw forbidden("Admin or attendant access required");
    next();
  } catch (err) {
    next(err);
  }
}

export function requireCustomer(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const payload = verifyToken(getToken(req));
    if (payload.role !== "customer") throw forbidden("Customer access required");
    req.customer = payload;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAffiliate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const payload = verifyToken(getToken(req));
    if (payload.role !== "affiliate") throw forbidden("Affiliate access required");
    req.affiliate = payload;
    next();
  } catch (err) {
    next(err);
  }
}
