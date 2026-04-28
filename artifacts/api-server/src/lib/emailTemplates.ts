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
    "Short transactional confirmation sent immediately after an admin registers.",
    "Welcome to Pointify, {{adminName}}",
    "Your account is ready",
    `<p>Hi {{adminName}},</p>
     <p>Your Pointify account is ready.</p>
     <p><strong>Account details</strong><br/>Email: {{adminEmail}}<br/>Username: {{adminUsername}}</p>
     <p>You can sign in any time to set up your first shop.</p>
     <p>— The Pointify team</p>`,
    "Hi {{adminName}}, your Pointify account is ready. Email: {{adminEmail}}. Sign in any time to set up your first shop.",
  ),
  make(
    "admin_welcome_features",
    "engagement",
    "Sent ~24 hours after admin signup to walk through what Pointify can do.",
    "{{adminName}}, here's what you can do with Pointify",
    "A quick tour of your new shop tools",
    `<p>Hi {{adminName}},</p>
     <p>Now that your account is set up, here's a quick look at what Pointify can do for you:</p>
     <ul style="padding-left:18px;line-height:1.7">
       <li><strong>Point of sale</strong> on any device, with cash, M-Pesa, card or split payments.</li>
       <li><strong>Real-time stock</strong> with low-stock alerts and supplier purchase orders.</li>
       <li><strong>Customer profiles</strong>, wallets, loyalty points and digital receipts.</li>
       <li><strong>Multiple shops and attendants</strong> managed from one dashboard.</li>
       <li><strong>Daily sales, profit and shift reports</strong> that are easy to read.</li>
       <li><strong>Referral commissions</strong> when other shops sign up through your link.</li>
     </ul>
     <p>Sign in and add your first product — most shops ring up their first sale within 10 minutes.</p>
     <p>Hit reply if you have any questions, we read every email.</p>
     <p>— The Pointify team</p>`,
    "Hi {{adminName}}, here's what you can do with Pointify: point of sale on any device, real-time stock, customer loyalty, multi-shop management, clear daily reports, and referral commissions. Sign in any time to add your first product.",
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
     <p>Open this link to choose a new password (expires in {{expiryMinutes}} minutes):<br/><a href="{{resetUrl}}">{{resetUrl}}</a></p>
     <p>If you didn't request this, you can safely ignore this email.</p>`,
    "Reset your password: {{resetUrl}} (expires in {{expiryMinutes}} minutes)",
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
     <p>Sign in and change your password right after your first login.</p>`,
    "You've been added to {{shopName}} as an attendant. Username: {{attendantUsername}}, temp password: {{tempPassword}}.",
  ),
  make(
    "attendant_password_reset",
    "auth",
    "Password reset link for an attendant.",
    "Reset your attendant password",
    "Reset your password",
    `<p>Use this link to set a new password for your attendant account at {{shopName}} (expires in {{expiryMinutes}} minutes):<br/><a href="{{resetUrl}}">{{resetUrl}}</a></p>`,
    "Reset password: {{resetUrl}}",
  ),

  // ── Customers ───────────────────────────────────────────────────────────────
  make(
    "customer_welcome",
    "customers",
    "Welcome email when a customer account is created.",
    "Welcome to {{shopName}}",
    "Thanks for joining us",
    `<p>Hi {{customerName}},</p>
     <p>Your account at <strong>{{shopName}}</strong> is ready. Going forward you'll receive your receipts, order updates, and loyalty rewards by email.</p>`,
    "Welcome to {{shopName}}, {{customerName}}! Your account is ready.",
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
    `<p>Use this link to set a new password (expires in {{expiryMinutes}} minutes):<br/><a href="{{resetUrl}}">{{resetUrl}}</a></p>
     <p>If you didn't request this, you can safely ignore this email.</p>`,
    "Reset: {{resetUrl}}",
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
  ),
  make(
    "order_shipped",
    "orders",
    "Notification when an order ships.",
    "Order #{{orderNo}} is on the way",
    "Your order has shipped",
    `<p>Your order is on the way 🚚</p>
     <p>Carrier: {{carrier}}<br/>Tracking number: <strong>{{trackingNumber}}</strong><br/>Estimated delivery: {{eta}}</p>
     <p>Track your shipment with the carrier using the tracking number above.</p>`,
    "Order {{orderNo}} shipped via {{carrier}} ({{trackingNumber}}). ETA {{eta}}.",
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
  ),
  make(
    "subscription_renewal_reminder",
    "billing",
    "Reminder a few days before subscription renewal.",
    "Your subscription renews on {{nextBillingDate}}",
    "Subscription renewal coming up",
    `<p>Heads up — your <strong>{{planName}}</strong> subscription will renew on {{nextBillingDate}} for {{amount}}.</p>`,
    "{{planName}} renews on {{nextBillingDate}} ({{amount}}).",
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
  ),
  make(
    "subscription_payment_failed",
    "billing",
    "Sent when a subscription charge fails.",
    "Payment failed for {{planName}}",
    "Payment failed",
    `<p>We couldn't process your payment of <strong>{{amount}}</strong> for {{planName}}.</p>
     <p>Reason: {{failureReason}}</p>
     <p>Please sign in and update your payment method to avoid service interruption.</p>`,
    "Payment of {{amount}} failed: {{failureReason}}. Update your payment method to avoid service interruption.",
  ),
  make(
    "subscription_expired",
    "billing",
    "Sent when a subscription expires.",
    "Your subscription has expired",
    "Subscription expired",
    `<p>Your <strong>{{planName}}</strong> plan expired on {{expiredOn}}. Renew to keep using premium features.</p>`,
    "{{planName}} expired on {{expiredOn}}. Renew to keep using premium features.",
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
     <p>Your referral link:<br/><code>{{referralUrl}}</code></p>
     <p>Sign in any time to track referrals, commissions, and payouts.</p>`,
    "Welcome! Your affiliate link: {{referralUrl}}",
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
  make(
    "admin_daily_report",
    "reports",
    "Daily end-of-day digest sent to each admin: sales, purchases, profit, expenses, low/expiring stock and credit sales due today. CSV files for each section are attached.",
    "Your daily report — {{reportDate}}",
    "Today at {{shopName}} 📊",
    `<p>Hi {{adminName}},</p>
     <p>Here's how today ({{reportDate}}) went across your shops. CSV attachments are included so you can dig deeper.</p>

     <h3 style="margin-top:24px;color:#0f766e">Daily summary</h3>
     <table style="border-collapse:collapse;width:100%;font-size:14px">
       <tr><td style="padding:6px 8px;border-bottom:1px solid #eee"><strong>Revenue</strong></td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">{{revenue}}</td></tr>
       <tr><td style="padding:6px 8px;border-bottom:1px solid #eee">Cash collected</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">{{cashCollected}}</td></tr>
       <tr><td style="padding:6px 8px;border-bottom:1px solid #eee">Outstanding (credit)</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">{{outstanding}}</td></tr>
       <tr><td style="padding:6px 8px;border-bottom:1px solid #eee"><strong>Expenses</strong></td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">{{expensesTotal}}</td></tr>
       <tr><td style="padding:6px 8px;border-bottom:1px solid #eee"><strong>Purchases</strong></td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">{{purchasesTotal}}</td></tr>
       <tr><td style="padding:6px 8px"><strong>Estimated profit</strong> (revenue − expenses)</td><td style="padding:6px 8px;text-align:right;font-weight:bold;color:{{profitColor}}">{{profit}}</td></tr>
     </table>

     <h3 style="margin-top:24px;color:#0f766e">At a glance</h3>
     <ul style="line-height:1.7">
       <li><strong>{{salesCount}}</strong> sales today</li>
       <li><strong>{{purchasesCount}}</strong> purchases recorded</li>
       <li><strong>{{lowStockCount}}</strong> products low or out of stock</li>
       <li><strong>{{expiringCount}}</strong> batches expiring in the next 7 days</li>
       <li><strong>{{creditDueCount}}</strong> credit sales due today ({{creditDueAmount}})</li>
     </ul>

     <p style="margin-top:24px;color:#666;font-size:13px">Attached: <code>sales.csv</code>, <code>purchases.csv</code>, <code>stock_alerts.csv</code>, <code>credit_due_today.csv</code>.</p>
     <p style="color:#666;font-size:13px">Sign in to your dashboard for the full picture.</p>
     <p>— The Pointify team</p>`,
    "Daily report for {{reportDate}}: revenue {{revenue}}, expenses {{expensesTotal}}, profit {{profit}}. {{salesCount}} sales, {{purchasesCount}} purchases, {{lowStockCount}} low-stock items, {{expiringCount}} expiring batches, {{creditDueCount}} credit sales due today.",
  ),
  make(
    "account_deleted",
    "system",
    "Sent right after an admin's account and all related data have been permanently deleted.",
    "Your Pointify account has been deleted",
    "Sorry to see you go 👋",
    `<p>Hi {{adminName}},</p>
     <p>Your Pointify account ({{adminEmail}}) and all of its data — shops, products, sales, customers, suppliers, reports — have now been permanently deleted from our systems.</p>
     <p>This action cannot be undone. If this wasn't you, reply to this email immediately so we can investigate.</p>
     <p>If we got something wrong or there's anything we could have done better, we'd genuinely love to hear it. Just hit reply.</p>
     <p>Thanks for the time you spent with us. The door is always open if you'd ever like to come back.</p>
     <p>— The Pointify team</p>`,
    "Your Pointify account ({{adminEmail}}) and all related data have been permanently deleted. If this wasn't you, reply immediately.",
  ),
  make(
    "admin_no_products_nudge",
    "engagement",
    "Sent ~2 days after admin signup if they haven't added any products yet.",
    "{{adminName}}, ready to add your first product?",
    "Your shop is waiting on you 👀",
    `<p>Hi {{adminName}},</p>
     <p>You signed up for Pointify a couple of days ago and we noticed your shop is still empty. No pressure — but most shops are up and selling within 10 minutes of adding their first product.</p>
     <p><strong>What you'll unlock the moment you add a product:</strong></p>
     <ul style="padding-left:18px;line-height:1.7">
       <li>Ring up sales on the till in seconds</li>
       <li>See live stock levels and low-stock alerts</li>
       <li>Send polished digital receipts to customers</li>
       <li>Start building loyalty and customer wallets</li>
     </ul>
     <p>Sign in any time and add a product — even just one — to bring your shop to life. We're here if you need a hand.</p>
     <p>Cheers,<br/>The Pointify team</p>`,
    "Hi {{adminName}}, your Pointify shop is still empty. Sign in and add your first product — most shops are selling within 10 minutes.",
  ),
  make(
    "admin_no_sales_nudge",
    "engagement",
    "Sent if an admin has added products but recorded no sales for ~5 days.",
    "{{adminName}}, your shop is set up — let's make a sale",
    "Don't let those products gather dust 🛍️",
    `<p>Hi {{adminName}},</p>
     <p>You've added products to your Pointify shop — that's the hard part done. But we haven't seen any sales in the last few days, and we wanted to check in.</p>
     <p><strong>A few quick ways to get started:</strong></p>
     <ul style="padding-left:18px;line-height:1.7">
       <li><strong>Open the till</strong> on a phone, tablet or laptop — it's ready when you are.</li>
       <li><strong>Invite an attendant</strong> so a teammate can ring up sales for you.</li>
       <li><strong>Print a quick receipt</strong> by recording a small test sale to see how everything flows.</li>
       <li><strong>Add a customer</strong> and let them earn loyalty points from day one.</li>
     </ul>
     <p>If something is in your way, hit reply and tell us — we'd love to help you make sale number one.</p>
     <p>Talk soon,<br/>The Pointify team</p>`,
    "Hi {{adminName}}, your Pointify shop is set up but we haven't seen any sales yet. Sign in and ring up a quick test sale — we're here if you need help.",
  ),
  make(
    "trial_expiring_soon",
    "billing",
    "Sent ~3 days before a trial subscription ends.",
    "Your Pointify trial ends in {{daysLeft}} days",
    "Don't lose what you've built ⏳",
    `<p>Hi {{adminName}},</p>
     <p>Your free trial of Pointify ends in <strong>{{daysLeft}} days</strong> ({{endDate}}). After that, you'll lose access to your dashboard, the till, and your reports.</p>
     <p><strong>Why pick a paid plan?</strong></p>
     <ul style="padding-left:18px;line-height:1.7">
       <li>Keep selling without interruption — your data, products and customers stay exactly as they are.</li>
       <li>Unlock unlimited sales, multi-shop support and full reporting.</li>
       <li>Get priority support whenever you need it.</li>
     </ul>
     <p>Sign in to your dashboard and pick the plan that fits your shop. It only takes a minute.</p>
     <p>Thanks for trying Pointify,<br/>The team</p>`,
    "Hi {{adminName}}, your Pointify trial ends in {{daysLeft}} days ({{endDate}}). Sign in to pick a plan and keep selling without interruption.",
  ),
  make(
    "trial_expired_followup",
    "billing",
    "Sent ~3 days after a trial expires to win the user back.",
    "We'd love to have you back, {{adminName}}",
    "Your shop is paused — but not gone",
    `<p>Hi {{adminName}},</p>
     <p>Your Pointify trial ended a few days ago and your shop is currently paused. Your products, customers and reports are still safe — we're just waiting for you to come back.</p>
     <p>If cost was the issue, we offer monthly plans starting small so you can grow at your own pace. If something else got in the way, just reply to this email and tell us — we read every one.</p>
     <p>Sign in any time to pick a plan and pick up exactly where you left off.</p>
     <p>Hope to see you soon,<br/>The Pointify team</p>`,
    "Hi {{adminName}}, your trial ended a few days ago but your data is safe. Sign in any time to pick a plan and pick up where you left off.",
  ),
  make(
    "stock_export",
    "reports",
    "Sent on demand when an admin exports a stock report.",
    "Stock report — {{shopName}}",
    "Your stock report is ready",
    `<p>Hi {{adminName}},</p>
     <p>Please find your stock report for <strong>{{shopName}}</strong> attached as a CSV file.</p>
     <ul style="padding-left:18px;line-height:1.7">
       <li><strong>Filter:</strong> {{filterLabel}}</li>
       <li><strong>Total products:</strong> {{totalProducts}}</li>
       <li><strong>Generated:</strong> {{generatedAt}}</li>
     </ul>
     <p>You can open the CSV in Excel, Google Sheets, or any spreadsheet app.</p>`,
    "Hi {{adminName}}, your stock report for {{shopName}} is attached (filter: {{filterLabel}}, {{totalProducts}} products, generated {{generatedAt}}).",
  ),
];

export const DEFAULT_TEMPLATES_BY_KEY: Record<string, EmailTemplate> = Object.fromEntries(
  DEFAULT_EMAIL_TEMPLATES.map((t) => [t.key, t]),
);

export const SETTINGS_NAME_PREFIX = "email_template:";
export const settingsName = (key: string) => `${SETTINGS_NAME_PREFIX}${key}`;
