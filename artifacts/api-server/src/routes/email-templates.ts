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

function render(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const val = key.split(".").reduce<unknown>((acc, part) => {
      if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, vars);
    return val === undefined || val === null ? `{{${key}}}` : String(val);
  });
}

const SAMPLE_VARS: Record<string, string> = {
  shopName: "Acme Supermarket",
  shopEmail: "hello@acme.test",
  shopPhone: "+254 700 000 000",
  adminName: "Fred Githumbi",
  adminEmail: "githumbi8fred@gmail.com",
  adminUsername: "fred",
  attendantName: "Jane Doe",
  attendantUsername: "jane",
  customerName: "Alex Mwangi",
  supplierName: "Premier Distributors",
  affiliateName: "Sam Otieno",
  otp: "428193",
  expiryMinutes: "10",
  tempPassword: "Welcome2026!",
  loginUrl: "https://app.pointify.test/login",
  resetUrl: "https://app.pointify.test/reset?token=abc123",
  accountUrl: "https://app.pointify.test/account",
  receiptUrl: "https://app.pointify.test/receipts/INV-1042",
  orderUrl: "https://app.pointify.test/orders/ORD-3309",
  trackingUrl: "https://carrier.test/track/TRK-77781",
  reorderUrl: "https://app.pointify.test/purchases/new?product=42",
  reportUrl: "https://app.pointify.test/reports/daily/2026-04-22",
  poUrl: "https://app.pointify.test/po/PO-118",
  billingUrl: "https://app.pointify.test/billing",
  invoiceUrl: "https://app.pointify.test/invoices/INV-99",
  dashboardUrl: "https://app.pointify.test/affiliate",
  referralUrl: "https://acme.test/?ref=fred",
  changedAt: "Apr 22, 2026 9:14 PM",
  receiptNo: "INV-1042",
  orderNo: "ORD-3309",
  poNumber: "PO-118",
  saleDate: "Apr 22, 2026",
  itemsTableRows:
    '<tr><td colspan="2">2× Maize Flour 2kg</td><td align="right">KES 360.00</td></tr>' +
    '<tr><td colspan="2">1× Cooking Oil 1L</td><td align="right">KES 290.00</td></tr>',
  subtotal: "KES 650.00",
  tax: "KES 0.00",
  discount: "KES 0.00",
  total: "KES 650.00",
  amountPaid: "KES 650.00",
  paymentMethod: "M-Pesa",
  refundAmount: "KES 290.00",
  refundMethod: "M-Pesa",
  reason: "Damaged on delivery",
  itemCount: "3",
  carrier: "G4S Courier",
  trackingNumber: "TRK-77781",
  eta: "Apr 24, 2026",
  refundNote: "A full refund of KES 650.00 will reach you within 3 days.",
  productName: "Maize Flour 2kg",
  currentQty: "4",
  unit: "pcs",
  threshold: "10",
  locationName: "Main Store",
  quantity: "6",
  recordedBy: "Jane Doe",
  lossValue: "KES 1,080.00",
  planName: "Pro Monthly",
  nextBillingDate: "May 22, 2026",
  amount: "KES 2,500.00",
  reference: "MPX9F8AB",
  failureReason: "Insufficient funds",
  expiredOn: "Apr 21, 2026",
  poDate: "Apr 22, 2026",
  poTotal: "KES 48,200.00",
  deliveryDate: "Apr 26, 2026",
  summaryDate: "Apr 22, 2026",
  salesTotal: "KES 84,300.00",
  salesCount: "47",
  refundsTotal: "KES 290.00",
  topProduct: "Maize Flour 2kg",
  topAttendant: "Jane Doe",
  cashOnHand: "KES 32,150.00",
  shiftDate: "Apr 22, 2026",
  shiftStart: "8:00 AM",
  shiftEnd: "5:00 PM",
  cashCollected: "KES 31,900.00",
  variance: "+KES 0.00",
  pointsEarned: "65",
  pointsBalance: "1,420",
  walletBalance: "KES 1,250.00",
  commissionAmount: "KES 480.00",
  availableBalance: "KES 6,820.00",
  payoutAmount: "KES 6,820.00",
  payoutMethod: "M-Pesa 0712345678",
  payoutReference: "PO-AF-2211",
};

router.get("/:key/preview", requireAdmin, async (req, res, next) => {
  try {
    const key = String(req.params["key"]);
    const row = await db.query.settings.findFirst({ where: eq(settings.name, settingsName(key)) });
    const tpl = mergeWithDefault(key, (row?.setting as StoredTemplate) ?? null);

    const queryVars: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === "string") queryVars[k] = v;
    }
    const vars = { ...SAMPLE_VARS, ...queryVars };

    const format = String(req.query["format"] ?? "html").toLowerCase();
    const subject = render(tpl.subject, vars);
    const html = render(tpl.html, vars);
    const text = render(tpl.text, vars);

    if (format === "json") {
      return ok(res, { key, subject, html, text, variables: tpl.variables });
    }
    if (format === "text") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(`Subject: ${subject}\n\n${text}`);
    }
    // Default: render the email HTML directly so it can be viewed in a browser.
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const banner = `<div style="background:#fffbeb;border-bottom:1px solid #fde68a;padding:8px 14px;font:13px -apple-system,Segoe UI,Roboto,sans-serif;color:#92400e">
      Preview · <strong>${key}</strong> · Subject: <em>${subject.replace(/</g, "&lt;")}</em>
      &nbsp;|&nbsp; <a href="?format=json">JSON</a> · <a href="?format=text">Plain text</a>
    </div>`;
    return res.send(banner + html);
  } catch (e) { next(e); }
});

router.post("/:key/preview", requireAdmin, async (req, res, next) => {
  try {
    const key = String(req.params["key"]);
    const row = await db.query.settings.findFirst({ where: eq(settings.name, settingsName(key)) });
    const tpl = mergeWithDefault(key, (row?.setting as StoredTemplate) ?? null);
    const vars = { ...SAMPLE_VARS, ...((req.body?.variables ?? req.body ?? {}) as Record<string, unknown>) };
    return ok(res, {
      key,
      subject: render(tpl.subject, vars),
      html: render(tpl.html, vars),
      text: render(tpl.text, vars),
      variables: tpl.variables,
    });
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
