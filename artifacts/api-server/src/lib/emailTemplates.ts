/**
 * Default email templates for the Pointify POS.
 *
 * Templates use Mustache-style `{{variable}}` placeholders. The `variables`
 * array lists the placeholders each template expects so admin UIs can render
 * a "available variables" hint in the editor.
 *
 * HTML uses inline styles for maximum email-client compatibility.
 */

export type EmailTemplate = {
  key: string;
  category: string;
  description: string;
  subject: string;
  html: string;
  text: string;
  variables: string[];
};

const wrap = (headline: string, body: string, cta?: { label: string; url: string }) => `
<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <tr><td style="background:#0f172a;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:600">{{shopName}}</td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 12px 0;font-size:22px;color:#0f172a">${headline}</h1>
        <div style="font-size:15px;line-height:1.6;color:#374151">${body}</div>
        ${cta ? `<div style="margin-top:24px"><a href="${cta.url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">${cta.label}</a></div>` : ""}
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid #eef2f7;font-size:12px;color:#9ca3af">
        Sent by {{shopName}} · {{shopEmail}} · {{shopPhone}}<br/>
        If you did not expect this email you can safely ignore it.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`.trim();

const make = (
  key: string,
  category: string,
  description: string,
  subject: string,
  headline: string,
  bodyHtml: string,
  bodyText: string,
  cta?: { label: string; url: string },
): EmailTemplate => {
  const html = wrap(headline, bodyHtml, cta);
  const variables = Array.from(
    new Set([...(html + " " + subject + " " + bodyText).matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]!)),
  ).sort();
  return { key, category, description, subject, html, text: bodyText, variables };
};

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  // ── Admin / account ─────────────────────────────────────────────────────────
  make(
    "admin_welcome",
    "auth",
    "Sent to a new admin immediately after they register an account.",
    "Welcome to {{shopName}}, {{adminName}}!",
    "Welcome aboard 🎉",
    `<p>Hi {{adminName}},</p>
     <p>Your admin account has been created successfully.</p>
     <p><strong>Account details</strong><br/>Email: {{adminEmail}}<br/>Username: {{adminUsername}}</p>
     <p>Next steps: sign in and start adding your products so you can begin selling.</p>`,
    "Hi {{adminName}}, your account has been created. Sign in and start adding your products to begin selling.",
  ),
  make(
    "admin_email_verification",
    "auth",
    "One-time code to verify an admin email address.",
    "Your verification code: {{otp}}",
    "Verify your email",
    `<p>Use this code to verify your email address:</p>
     <p style="font-size:28px;font-weight:700;letter-spacing:6px;background:#f1f5f9;padding:14px 22px;border-radius:8px;display:inline-block">{{otp}}</p>
     <p>The code expires in {{expiryMinutes}} minutes.</p>`,
    "Your verification code is {{otp}}. It expires in {{expiryMinutes}} minutes.",
  ),
  make(
    "admin_password_reset",
    "auth",
    "Sent when an admin requests a password reset.",
    "Reset your password",
    "Password reset request",
    `<p>We received a request to reset the password for <strong>{{adminEmail}}</strong>.</p>
     <p>Click the button below to choose a new password. The link expires in {{expiryMinutes}} minutes.</p>`,
    "Reset your password: {{resetUrl}} (expires in {{expiryMinutes}} minutes)",
    { label: "Reset password", url: "{{resetUrl}}" },
  ),
  make(
    "admin_password_changed",
    "auth",
    "Confirmation after a successful password change.",
    "Your password was changed",
    "Password updated",
    `<p>Hi {{adminName}},</p>
     <p>Your password was just changed at {{changedAt}}. If this wasn't you, please reset your password immediately and contact support.</p>`,
    "Your Pointify password was changed at {{changedAt}}.",
  ),

  // ── Attendants ──────────────────────────────────────────────────────────────
  make(
    "attendant_welcome",
    "auth",
    "Sent to a new attendant after the admin creates their account.",
    "You've been added to {{shopName}}",
    "You're on the team",
    `<p>Hi {{attendantName}},</p>
     <p>{{adminName}} has added you as an attendant at <strong>{{shopName}}</strong>.</p>
     <p><strong>Your login</strong><br/>Username: {{attendantUsername}}<br/>Temporary password: {{tempPassword}}</p>
     <p>Please change your password after your first sign-in.</p>`,
    "You've been added to {{shopName}} as an attendant. Username: {{attendantUsername}}, temp password: {{tempPassword}}.",
    { label: "Sign in", url: "{{loginUrl}}" },
  ),
  make(
    "attendant_password_reset",
    "auth",
    "Password reset link for an attendant.",
    "Reset your attendant password",
    "Reset your password",
    `<p>Click below to set a new password for your attendant account at {{shopName}}.</p>`,
    "Reset password: {{resetUrl}}",
    { label: "Reset password", url: "{{resetUrl}}" },
  ),

  // ── Customers ───────────────────────────────────────────────────────────────
  make(
    "customer_welcome",
    "customers",
    "Welcome email when a customer account is created.",
    "Welcome to {{shopName}}",
    "Thanks for joining us",
    `<p>Hi {{customerName}},</p>
     <p>Your customer account is ready. Track your orders, view receipts, and manage loyalty rewards from your dashboard.</p>`,
    "Welcome to {{shopName}}, {{customerName}}! Your account is ready.",
    { label: "View account", url: "{{accountUrl}}" },
  ),
  make(
    "customer_otp_login",
    "customers",
    "One-time login code for a customer.",
    "Your sign-in code: {{otp}}",
    "Sign-in code",
    `<p>Your sign-in code for {{shopName}}:</p>
     <p style="font-size:28px;font-weight:700;letter-spacing:6px;background:#f1f5f9;padding:14px 22px;border-radius:8px;display:inline-block">{{otp}}</p>`,
    "Sign-in code: {{otp}}",
  ),
  make(
    "customer_password_reset",
    "customers",
    "Password reset link for a customer.",
    "Reset your password",
    "Reset your password",
    `<p>Use the link below to reset your password.</p>`,
    "Reset: {{resetUrl}}",
    { label: "Reset password", url: "{{resetUrl}}" },
  ),

  // ── Sales / receipts ────────────────────────────────────────────────────────
  make(
    "sale_receipt",
    "sales",
    "Email receipt sent to a customer after a sale.",
    "Receipt #{{receiptNo}} from {{shopName}}",
    "Thanks for your purchase",
    `<p>Hi {{customerName}},</p>
     <p>Here's your receipt for the sale on {{saleDate}}.</p>
     <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin-top:14px">
       {{itemsTableRows}}
       <tr><td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:10px"><strong>Subtotal</strong></td><td align="right" style="border-top:1px solid #e5e7eb;padding-top:10px">{{subtotal}}</td></tr>
       <tr><td colspan="2">Tax</td><td align="right">{{tax}}</td></tr>
       <tr><td colspan="2">Discount</td><td align="right">-{{discount}}</td></tr>
       <tr><td colspan="2"><strong>Total</strong></td><td align="right"><strong>{{total}}</strong></td></tr>
       <tr><td colspan="2">Paid via {{paymentMethod}}</td><td align="right">{{amountPaid}}</td></tr>
     </table>
     <p style="margin-top:16px">Receipt #: <strong>{{receiptNo}}</strong></p>`,
    "Receipt {{receiptNo}} — Total {{total}} paid via {{paymentMethod}}. Thank you!",
  ),
  make(
    "sale_refund",
    "sales",
    "Confirmation when a sale is refunded.",
    "Refund processed for receipt #{{receiptNo}}",
    "Refund processed",
    `<p>A refund of <strong>{{refundAmount}}</strong> for receipt #{{receiptNo}} has been processed.</p>
     <p>Refund method: {{refundMethod}}<br/>Reason: {{reason}}</p>`,
    "Refund of {{refundAmount}} processed for receipt {{receiptNo}}.",
  ),

  // ── Online orders ───────────────────────────────────────────────────────────
  make(
    "order_confirmation",
    "orders",
    "Order confirmation when a customer places an online order.",
    "Order #{{orderNo}} confirmed",
    "We've got your order",
    `<p>Hi {{customerName}},</p>
     <p>Thanks for your order. We'll let you know when it ships.</p>
     <p><strong>Order #{{orderNo}}</strong> · {{itemCount}} items · {{total}}</p>`,
    "Order {{orderNo}} confirmed. Total {{total}}.",
    { label: "Track order", url: "{{orderUrl}}" },
  ),
  make(
    "order_shipped",
    "orders",
    "Notification when an order ships.",
    "Order #{{orderNo}} is on the way",
    "Your order has shipped",
    `<p>Your order is on the way 🚚</p>
     <p>Carrier: {{carrier}}<br/>Tracking: {{trackingNumber}}<br/>Estimated delivery: {{eta}}</p>`,
    "Order {{orderNo}} shipped via {{carrier}} ({{trackingNumber}}).",
    { label: "Track shipment", url: "{{trackingUrl}}" },
  ),
  make(
    "order_delivered",
    "orders",
    "Notification when an order is delivered.",
    "Order #{{orderNo}} delivered",
    "Delivered ✅",
    `<p>Your order #{{orderNo}} has been delivered. Enjoy!</p>
     <p>If anything's not right, just reply to this email.</p>`,
    "Order {{orderNo}} delivered.",
  ),
  make(
    "order_cancelled",
    "orders",
    "Notification when an order is cancelled.",
    "Order #{{orderNo}} cancelled",
    "Order cancelled",
    `<p>Order #{{orderNo}} has been cancelled.</p>
     <p>Reason: {{reason}}<br/>{{refundNote}}</p>`,
    "Order {{orderNo}} cancelled. {{reason}}",
  ),

  // ── Inventory alerts ────────────────────────────────────────────────────────
  make(
    "low_stock_alert",
    "inventory",
    "Sent to admin/managers when stock falls below the configured threshold.",
    "Low stock: {{productName}}",
    "Low stock alert ⚠️",
    `<p>Stock for <strong>{{productName}}</strong> is running low.</p>
     <p>Current quantity: {{currentQty}} {{unit}}<br/>Threshold: {{threshold}} {{unit}}<br/>Location: {{locationName}}</p>`,
    "Low stock: {{productName}} — {{currentQty}} {{unit}} (threshold {{threshold}}).",
    { label: "Reorder now", url: "{{reorderUrl}}" },
  ),
  make(
    "bad_stock_alert",
    "inventory",
    "Notifies admin when bad/expired stock is recorded.",
    "Bad stock recorded: {{productName}}",
    "Bad stock recorded",
    `<p>{{quantity}} {{unit}} of <strong>{{productName}}</strong> was marked as bad stock by {{recordedBy}}.</p>
     <p>Reason: {{reason}}<br/>Loss value: {{lossValue}}</p>`,
    "Bad stock: {{quantity}} {{unit}} of {{productName}} ({{reason}}).",
  ),

  // ── Subscriptions / billing ─────────────────────────────────────────────────
  make(
    "subscription_activated",
    "billing",
    "Sent when a subscription is activated.",
    "Your {{planName}} subscription is active",
    "Subscription activated",
    `<p>Your <strong>{{planName}}</strong> plan is now active.</p>
     <p>Next billing date: {{nextBillingDate}}<br/>Amount: {{amount}}</p>`,
    "{{planName}} active. Next billing: {{nextBillingDate}}.",
    { label: "Manage subscription", url: "{{billingUrl}}" },
  ),
  make(
    "subscription_renewal_reminder",
    "billing",
    "Reminder a few days before subscription renewal.",
    "Your subscription renews on {{nextBillingDate}}",
    "Subscription renewal coming up",
    `<p>Heads up — your <strong>{{planName}}</strong> subscription will renew on {{nextBillingDate}} for {{amount}}.</p>`,
    "{{planName}} renews on {{nextBillingDate}} ({{amount}}).",
    { label: "Manage subscription", url: "{{billingUrl}}" },
  ),
  make(
    "subscription_payment_success",
    "billing",
    "Receipt when a subscription payment succeeds.",
    "Payment received — {{amount}}",
    "Payment received",
    `<p>We've received your payment of <strong>{{amount}}</strong> for the {{planName}} plan.</p>
     <p>Reference: {{reference}}<br/>Next billing: {{nextBillingDate}}</p>`,
    "Payment of {{amount}} received. Ref {{reference}}.",
    { label: "Download invoice", url: "{{invoiceUrl}}" },
  ),
  make(
    "subscription_payment_failed",
    "billing",
    "Sent when a subscription charge fails.",
    "Payment failed for {{planName}}",
    "Payment failed",
    `<p>We couldn't process your payment of <strong>{{amount}}</strong> for {{planName}}.</p>
     <p>Reason: {{failureReason}}</p>
     <p>Please update your payment method to avoid service interruption.</p>`,
    "Payment of {{amount}} failed: {{failureReason}}.",
    { label: "Update payment method", url: "{{billingUrl}}" },
  ),
  make(
    "subscription_expired",
    "billing",
    "Sent when a subscription expires.",
    "Your subscription has expired",
    "Subscription expired",
    `<p>Your <strong>{{planName}}</strong> plan expired on {{expiredOn}}. Renew to keep using premium features.</p>`,
    "{{planName}} expired on {{expiredOn}}.",
    { label: "Renew now", url: "{{billingUrl}}" },
  ),

  // ── Suppliers / purchases ───────────────────────────────────────────────────
  make(
    "purchase_order_to_supplier",
    "purchases",
    "Purchase order sent to a supplier.",
    "Purchase Order #{{poNumber}} from {{shopName}}",
    "New purchase order",
    `<p>Hi {{supplierName}},</p>
     <p>Please find purchase order <strong>#{{poNumber}}</strong> dated {{poDate}}.</p>
     <p>Total items: {{itemCount}}<br/>Total value: {{poTotal}}<br/>Required by: {{deliveryDate}}</p>`,
    "PO {{poNumber}} — {{itemCount}} items, total {{poTotal}}, due {{deliveryDate}}.",
  ),

  // ── Reports ─────────────────────────────────────────────────────────────────
  make(
    "daily_sales_summary",
    "reports",
    "End-of-day sales summary email to admin.",
    "Daily summary — {{summaryDate}}",
    "Today at {{shopName}}",
    `<p>Here's how today went:</p>
     <ul>
       <li>Sales: <strong>{{salesTotal}}</strong> ({{salesCount}} transactions)</li>
       <li>Refunds: {{refundsTotal}}</li>
       <li>Top product: {{topProduct}}</li>
       <li>Top attendant: {{topAttendant}}</li>
       <li>Cash on hand: {{cashOnHand}}</li>
     </ul>`,
    "Daily summary {{summaryDate}}: sales {{salesTotal}} ({{salesCount}} txns).",
    { label: "Open report", url: "{{reportUrl}}" },
  ),
  make(
    "shift_summary",
    "reports",
    "Sent to an attendant when their shift closes.",
    "Shift closed — {{shiftDate}}",
    "Shift summary",
    `<p>Hi {{attendantName}},</p>
     <p>Your shift from {{shiftStart}} to {{shiftEnd}} is now closed.</p>
     <ul>
       <li>Sales: <strong>{{salesTotal}}</strong></li>
       <li>Transactions: {{salesCount}}</li>
       <li>Cash collected: {{cashCollected}}</li>
       <li>Variance: {{variance}}</li>
     </ul>`,
    "Shift closed. Sales {{salesTotal}}, variance {{variance}}.",
  ),

  // ── Loyalty / wallets ───────────────────────────────────────────────────────
  make(
    "customer_loyalty_points",
    "loyalty",
    "Notifies a customer when they earn or redeem loyalty points.",
    "You earned {{pointsEarned}} points",
    "Loyalty update",
    `<p>Hi {{customerName}},</p>
     <p>You earned <strong>{{pointsEarned}}</strong> points from your recent purchase.</p>
     <p>New balance: <strong>{{pointsBalance}}</strong></p>`,
    "You earned {{pointsEarned}} points. Balance: {{pointsBalance}}.",
  ),
  make(
    "wallet_topup_confirmation",
    "loyalty",
    "Confirmation that a customer's wallet was topped up.",
    "Wallet topped up: {{amount}}",
    "Wallet topped up",
    `<p>Hi {{customerName}},</p>
     <p><strong>{{amount}}</strong> has been added to your wallet.</p>
     <p>New balance: <strong>{{walletBalance}}</strong></p>`,
    "{{amount}} added to your wallet. Balance: {{walletBalance}}.",
  ),

  // ── Affiliates ──────────────────────────────────────────────────────────────
  make(
    "affiliate_welcome",
    "affiliate",
    "Welcomes a new affiliate.",
    "Welcome to the {{shopName}} affiliate program",
    "You're an affiliate now",
    `<p>Hi {{affiliateName}},</p>
     <p>Your affiliate account is live. Share your unique link to start earning commissions.</p>
     <p>Your referral link:<br/><code>{{referralUrl}}</code></p>`,
    "Welcome! Your affiliate link: {{referralUrl}}",
    { label: "Open dashboard", url: "{{dashboardUrl}}" },
  ),
  make(
    "affiliate_commission_earned",
    "affiliate",
    "Sent when an affiliate earns a commission.",
    "You earned {{commissionAmount}}",
    "Commission earned 💸",
    `<p>Nice work! You just earned <strong>{{commissionAmount}}</strong> from a referral.</p>
     <p>Available balance: <strong>{{availableBalance}}</strong></p>`,
    "You earned {{commissionAmount}}. Balance: {{availableBalance}}.",
  ),
  make(
    "affiliate_payout",
    "affiliate",
    "Confirms an affiliate withdrawal/payout.",
    "Payout sent: {{payoutAmount}}",
    "Payout sent",
    `<p>Your payout of <strong>{{payoutAmount}}</strong> has been sent to {{payoutMethod}}.</p>
     <p>Reference: {{payoutReference}}</p>`,
    "Payout {{payoutAmount}} sent via {{payoutMethod}}. Ref {{payoutReference}}.",
  ),
];

export const DEFAULT_TEMPLATES_BY_KEY: Record<string, EmailTemplate> = Object.fromEntries(
  DEFAULT_EMAIL_TEMPLATES.map((t) => [t.key, t]),
);

export const SETTINGS_NAME_PREFIX = "email_template:";
export const settingsName = (key: string) => `${SETTINGS_NAME_PREFIX}${key}`;
