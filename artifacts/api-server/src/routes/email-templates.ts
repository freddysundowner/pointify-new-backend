import { Router } from "express";
import { eq, like } from "drizzle-orm";
import { settings } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, noContent } from "../lib/response.js";
import { badRequest, notFound } from "../lib/errors.js";
import { requireAdmin, requireSuperAdmin } from "../middlewares/auth.js";
import {
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_TEMPLATES_BY_KEY,
  SETTINGS_NAME_PREFIX,
  settingsName,
  type EmailTemplate,
} from "../lib/emailTemplates.js";

const router = Router();

type StoredTemplate = Partial<EmailTemplate> & { key: string };

function mergeWithDefault(key: string, override?: StoredTemplate | null): EmailTemplate & { isOverridden: boolean } {
  const def = DEFAULT_TEMPLATES_BY_KEY[key];
  if (!def) {
    if (!override) throw notFound(`Email template "${key}" not found`);
    return { ...(override as EmailTemplate), isOverridden: true };
  }
  if (!override) return { ...def, isOverridden: false };
  return {
    ...def,
    ...override,
    variables: override.variables ?? def.variables,
    isOverridden: true,
  };
}

router.get("/", requireAdmin, async (_req, res, next) => {
  try {
    const overrides = await db.query.settings.findMany({
      where: like(settings.name, `${SETTINGS_NAME_PREFIX}%`),
    });
    const overrideMap = new Map<string, StoredTemplate>();
    for (const row of overrides) {
      const key = row.name.slice(SETTINGS_NAME_PREFIX.length);
      overrideMap.set(key, row.setting as StoredTemplate);
    }

    const keys = new Set<string>([...DEFAULT_EMAIL_TEMPLATES.map((t) => t.key), ...overrideMap.keys()]);
    const list = Array.from(keys)
      .sort()
      .map((k) => mergeWithDefault(k, overrideMap.get(k) ?? null));

    return ok(res, list);
  } catch (e) { next(e); }
});

router.get("/defaults", requireAdmin, async (_req, res, next) => {
  try {
    return ok(res, DEFAULT_EMAIL_TEMPLATES);
  } catch (e) { next(e); }
});

router.get("/:key", requireAdmin, async (req, res, next) => {
  try {
    const key = String(req.params["key"]);
    const row = await db.query.settings.findFirst({ where: eq(settings.name, settingsName(key)) });
    return ok(res, mergeWithDefault(key, (row?.setting as StoredTemplate) ?? null));
  } catch (e) { next(e); }
});

router.put("/:key", requireSuperAdmin, async (req, res, next) => {
  try {
    const key = String(req.params["key"]);
    if (!key) throw badRequest("template key required");
    const def = DEFAULT_TEMPLATES_BY_KEY[key];
    const incoming = req.body ?? {};

    // Allow custom keys (not in defaults) but require subject + html when no default exists.
    if (!def && (!incoming.subject || !incoming.html)) {
      throw badRequest("Custom templates must include `subject` and `html`");
    }

    const stored: StoredTemplate = {
      key,
      category: incoming.category ?? def?.category ?? "custom",
      description: incoming.description ?? def?.description ?? "",
      subject: incoming.subject ?? def?.subject,
      html: incoming.html ?? def?.html,
      text: incoming.text ?? def?.text ?? "",
      variables: incoming.variables ?? def?.variables ?? [],
    };

    const name = settingsName(key);
    const existing = await db.query.settings.findFirst({ where: eq(settings.name, name) });
    if (existing) {
      const [updated] = await db.update(settings)
        .set({ setting: stored, updatedAt: new Date() })
        .where(eq(settings.name, name))
        .returning();
      return ok(res, mergeWithDefault(key, updated.setting as StoredTemplate));
    }
    const [created] = await db.insert(settings).values({ name, setting: stored }).returning();
    return ok(res, mergeWithDefault(key, created.setting as StoredTemplate));
  } catch (e) { next(e); }
});

router.delete("/:key", requireSuperAdmin, async (req, res, next) => {
  try {
    const key = String(req.params["key"]);
    const [deleted] = await db.delete(settings)
      .where(eq(settings.name, settingsName(key)))
      .returning();
    if (!deleted) throw notFound("No override exists for this template");
    return noContent(res);
  } catch (e) { next(e); }
});

router.post("/seed", requireSuperAdmin, async (req, res, next) => {
  try {
    const overwrite = req.query["overwrite"] === "true" || req.body?.overwrite === true;
    const existing = await db.query.settings.findMany({
      where: like(settings.name, `${SETTINGS_NAME_PREFIX}%`),
    });
    const existingKeys = new Set(existing.map((r) => r.name));

    const created: string[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];

    for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
      const name = settingsName(tpl.key);
      if (existingKeys.has(name)) {
        if (overwrite) {
          await db.update(settings)
            .set({ setting: tpl, updatedAt: new Date() })
            .where(eq(settings.name, name));
          updated.push(tpl.key);
        } else {
          skipped.push(tpl.key);
        }
      } else {
        await db.insert(settings).values({ name, setting: tpl });
        created.push(tpl.key);
      }
    }
    return ok(res, { created, updated, skipped, totalDefaults: DEFAULT_EMAIL_TEMPLATES.length });
  } catch (e) { next(e); }
});

export default router;
