import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalize an API entity so it always has both `id` and `_id`.
 * PostgreSQL API returns numeric `id`; legacy code expects `_id`.
 * Passing any object through this helper ensures both fields are set.
 */
export function normalizeId<T extends Record<string, any>>(obj: T): T & { _id: any; id: any } {
  if (!obj) return obj as any;
  const id  = obj.id  ?? obj._id;
  const _id = obj._id ?? obj.id;
  return { ...obj, id, _id };
}

/** Apply normalizeId to every item in an array. */
export function normalizeIds<T extends Record<string, any>>(arr: T[]): (T & { _id: any; id: any })[] {
  return Array.isArray(arr) ? arr.map(normalizeId) : arr;
}

/**
 * Safely extract the ID from a value that could be either a scalar (number/string)
 * or a populated object ({ id, _id }).
 * Used wherever legacy code used `something._id` and the API now returns a plain integer.
 */
export function extractId(value: any): string | number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'object') return value._id ?? value.id;
  return value; // already a scalar (number or string)
}
