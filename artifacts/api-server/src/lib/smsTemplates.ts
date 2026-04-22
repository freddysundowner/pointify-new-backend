/**
 * Default SMS templates for Pointify POS.
 *
 * SMS bodies use Mustache-style {{variable}} placeholders. Keep them under
 * 160 characters where possible so they fit a single SMS segment.
 */
export type SmsTemplate = {
  key: string;
  description: string;
  body: string;
  variables: string[];
};

function t(key: string, description: string, body: string, variables: string[]): SmsTemplate {
  return { key, description, body, variables };
}

export const DEFAULT_SMS_TEMPLATES: SmsTemplate[] = [
  t(
    "subscription_expiry_reminder",
    "Sent daily for the 5 days leading up to subscription expiry.",
    "Hi {{adminName}}, your Pointify subscription expires in {{daysLeft}} day(s). Renew at pointifypos.com to avoid service interruption. Help: +254 791 334 234",
    ["adminName", "daysLeft"],
  ),
  t(
    "subscription_expired",
    "Sent once on the day a subscription expires.",
    "Hi {{adminName}}, your Pointify subscription has expired. Renew at pointifypos.com to restore access. Help: +254 791 334 234",
    ["adminName"],
  ),
  t(
    "subscription_payment_success",
    "Sent to the admin after a successful subscription payment.",
    "Hi {{adminName}}, your Pointify {{planName}} subscription is active. Shops covered: {{shopCount}}. Thank you! pointifypos.com",
    ["adminName", "planName", "shopCount"],
  ),
  t(
    "affiliate_commission_earned",
    "Sent to the affiliate when an admin they referred subscribes.",
    "Hi {{affiliateName}}, you earned KES {{commission}} commission from {{adminName}}'s subscription. Wallet balance: KES {{balance}}. pointifypos.com",
    ["affiliateName", "adminName", "commission", "balance"],
  ),
  t(
    "shop_dormant_30d",
    "Sent when an admin's shops have had no sales for 30 days.",
    "Hi {{adminName}}, your shop has had no sales for 30 days. Need help getting started? Reply or call +254 791 334 234. — Pointify POS",
    ["adminName"],
  ),
  t(
    "admin_daily_summary",
    "Sent at 20:00 to each admin who has SMS sending enabled and credits remaining — recap of today's numbers across all their shops.",
    "Hi {{adminName}}, today: {{salesCount}} sale(s), revenue KES {{revenue}}, paid KES {{cashCollected}}, expenses KES {{expenses}}, profit KES {{profit}}. Pointify POS",
    ["adminName", "salesCount", "revenue", "cashCollected", "expenses", "profit"],
  ),
  t(
    "sale_receipt",
    "Sent to the customer for every completed sale (when admin opts in).",
    "Receipt from {{shopName}}: {{itemCount}} item(s), total KES {{total}}. View: {{receiptUrl}} Thank you!",
    ["shopName", "itemCount", "total", "receiptUrl"],
  ),
];

export const SMS_TEMPLATES_BY_KEY: Record<string, SmsTemplate> = Object.fromEntries(
  DEFAULT_SMS_TEMPLATES.map((tpl) => [tpl.key, tpl]),
);

export function renderSms(tpl: string, vars: Record<string, unknown>): string {
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
