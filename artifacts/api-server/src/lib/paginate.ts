import type { Request } from "express";

export function getPagination(req: Request, defaultLimit = 20) {
  const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10) || 1);
  const limit = Math.min(
    200,
    Math.max(1, parseInt(String(req.query["limit"] ?? String(defaultLimit)), 10) || defaultLimit),
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function getSearch(req: Request): string {
  return String(req.query["search"] ?? "").trim();
}
