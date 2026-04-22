/**
 * Central email sender. Reads provider credentials from
 *   system/settings/email   →  { provider, apiKey, fromName, fromAddress, replyTo }
 * Loads template from settings (override) or built-in defaults, renders
 * Mustache-style {{vars}}, and posts to Brevo's transactional API.
 *
 * Sending is best-effort — failures are logged but never thrown to the caller
 * so business operations are not blocked by email outages.
 */
import { eq } from "drizzle-orm";
import { settings } from "@workspace/db";
import { db } from "./db.js";
import { logger } from "./logger.js";
import {
  DEFAULT_TEMPLATES_BY_KEY,
  settingsName,
  type EmailTemplate,
} from "./emailTemplates.js";

type EmailConfig = {
  provider?: "brevo" | "smtp" | string;
  apiKey?: string;
  fromName?: string;
  fromAddress?: string;
  replyTo?: string;
};

let configCache: { value: EmailConfig | null; expiresAt: number } | null = null;
const CONFIG_TTL_MS = 60_000;

async function getEmailConfig(): Promise<EmailConfig | null> {
  const now = Date.now();
  if (configCache && configCache.expiresAt > now) return configCache.value;
  const row = await db.query.settings.findFirst({ where: eq(settings.name, "email") });
  const value = (row?.setting ?? null) as EmailConfig | null;
  configCache = { value, expiresAt: now + CONFIG_TTL_MS };
  return value;
}

/** Reset the in-memory config cache (called when /system/settings/email is updated). */
export function clearEmailConfigCache() {
  configCache = null;
}

async function loadTemplate(key: string): Promise<EmailTemplate | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.name, settingsName(key)) });
  if (row) {
    const stored = row.setting as Partial<EmailTemplate>;
    const def = DEFAULT_TEMPLATES_BY_KEY[key];
    if (!def && (!stored.subject || !stored.html)) return null;
    return {
      key,
      category: stored.category ?? def?.category ?? "custom",
      description: stored.description ?? def?.description ?? "",
      subject: stored.subject ?? def!.subject,
      html: stored.html ?? def!.html,
      text: stored.text ?? def?.text ?? "",
      variables: stored.variables ?? def?.variables ?? [],
    };
  }
  return DEFAULT_TEMPLATES_BY_KEY[key] ?? null;
}

function render(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const val = key.split(".").reduce<unknown>((acc, part) => {
      if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, vars);
    return val === undefined || val === null ? "" : String(val);
  });
}

export type SendEmailInput = {
  key: string;
  to: string | { email: string; name?: string };
  vars?: Record<string, unknown>;
  /** Optional file attachments. `content` must already be base64-encoded. */
  attachments?: { name: string; content: string }[];
};

export type SendEmailResult = {
  ok: boolean;
  skipped?: string;
  messageId?: string;
  error?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const recipient = typeof input.to === "string" ? { email: input.to } : input.to;
    if (!recipient.email) return { ok: false, skipped: "no recipient email" };

    const tpl = await loadTemplate(input.key);
    if (!tpl) {
      logger.warn({ key: input.key }, "email template not found");
      return { ok: false, skipped: `template "${input.key}" not found` };
    }

    const cfg = await getEmailConfig();
    if (!cfg || !cfg.apiKey || !cfg.fromAddress) {
      logger.info({ key: input.key, to: recipient.email }, "email not sent — provider not configured");
      return { ok: false, skipped: "email provider not configured (set /system/settings/email)" };
    }

    const vars = input.vars ?? {};
    const subject = render(tpl.subject, vars);
    const htmlContent = render(tpl.html, vars);
    const textContent = render(tpl.text, vars);

    const provider = (cfg.provider ?? "brevo").toLowerCase();
    if (provider !== "brevo") {
      logger.warn({ provider }, "only brevo is wired up — skipping send");
      return { ok: false, skipped: `provider "${provider}" not implemented` };
    }

    const payload: Record<string, unknown> = {
      sender: { email: cfg.fromAddress, name: cfg.fromName ?? cfg.fromAddress },
      to: [{ email: recipient.email, ...(recipient.name ? { name: recipient.name } : {}) }],
      subject,
      htmlContent,
      ...(textContent ? { textContent } : {}),
      ...(cfg.replyTo ? { replyTo: { email: cfg.replyTo } } : {}),
      ...(input.attachments && input.attachments.length > 0 ? { attachment: input.attachments } : {}),
    };

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": cfg.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn({ key: input.key, status: res.status, body: text }, "brevo send failed");
      return { ok: false, error: `Brevo ${res.status}: ${text}` };
    }
    const json = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { ok: true, messageId: json.messageId };
  } catch (err) {
    logger.error({ err, key: input.key }, "email send threw");
    return { ok: false, error: (err as Error).message };
  }
}

/** Fire-and-forget wrapper — never blocks/throws to the caller. */
export function sendEmailAsync(input: SendEmailInput): void {
  sendEmail(input).catch((err) => logger.error({ err, key: input.key }, "sendEmailAsync failed"));
}
