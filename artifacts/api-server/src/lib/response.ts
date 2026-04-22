import type { Response } from "express";

export function ok(res: Response, data: unknown, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function created(res: Response, data: unknown) {
  return ok(res, data, 201);
}

export function paginated(
  res: Response,
  data: unknown[],
  meta: { total: number; page: number; limit: number },
) {
  return res.json({
    success: true,
    data,
    meta: {
      ...meta,
      totalPages: Math.ceil(meta.total / meta.limit),
    },
  });
}

export function noContent(res: Response) {
  return res.status(204).end();
}
