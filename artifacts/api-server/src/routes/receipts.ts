/**
 * Public receipt viewer — `GET /api/r/:token`
 * Renders a styled HTML receipt for an unauthenticated customer link.
 */
import { Router, type Request, type Response } from "express";
import { db } from "../lib/db.js";
import { sales, saleItems, salePayments, shops, customers, products } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { verifyReceiptToken } from "../lib/receipts.js";

const router = Router();

const fmt = (n: unknown) => Number(n ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] as string));

router.get("/:token", async (req: Request, res: Response) => {
  const saleId = verifyReceiptToken(String(req.params["token"] ?? ""));
  if (!saleId) {
    res.status(404).type("html").send(notFoundHtml());
    return;
  }

  const sale = await db.query.sales.findFirst({ where: eq(sales.id, saleId) });
  if (!sale) {
    res.status(404).type("html").send(notFoundHtml());
    return;
  }
  const shop = await db.query.shops.findFirst({ where: eq(shops.id, sale.shop) });
  const cust = sale.customer ? await db.query.customers.findFirst({ where: eq(customers.id, sale.customer) }) : null;
  const items = await db.query.saleItems.findMany({ where: eq(saleItems.sale, saleId) });
  const payments = await db.query.salePayments.findMany({ where: eq(salePayments.sale, saleId) });
  const productIds = items.map((i) => i.product).filter((x): x is number => !!x);
  const productRows = productIds.length
    ? await db.query.products.findMany({ where: inArray(products.id, productIds) })
    : [];
  const productById = new Map(productRows.map((p) => [p.id, p]));

  const itemsHtml = items.map((it) => {
    const p = productById.get(it.product as number);
    const qty = Number(it.quantity ?? 0);
    const price = Number(it.unitPrice ?? 0);
    const line = qty * price - Number(it.lineDiscount ?? 0);
    return `<tr>
      <td>${esc(p?.name ?? `#${it.product}`)}</td>
      <td class="num">${qty}</td>
      <td class="num">${fmt(price)}</td>
      <td class="num">${fmt(line)}</td>
    </tr>`;
  }).join("");

  const paymentsHtml = payments.map((p) => `
    <div class="row"><span>${esc(p.paymentType ?? "payment")}</span><span>KES ${fmt(p.amount)}</span></div>
  `).join("");

  const date = (sale.createdAt ?? new Date()).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });

  res.status(200).type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt ${esc(sale.receiptNo ?? `#${sale.id}`)} · ${esc(shop?.name ?? "Pointify POS")}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;padding:24px 12px}
    .receipt{max-width:380px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.08);padding:24px;font-size:13px;line-height:1.5}
    h1{font-size:18px;margin:0 0 4px;text-align:center;letter-spacing:.5px}
    .muted{color:#6b7280;font-size:12px;text-align:center}
    .divider{border:none;border-top:1px dashed #cbd5e1;margin:14px 0}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{padding:6px 4px;text-align:left;border-bottom:1px dotted #e5e7eb}
    th.num,td.num{text-align:right;font-variant-numeric:tabular-nums}
    .totals{margin-top:8px;font-size:13px}
    .row{display:flex;justify-content:space-between;padding:3px 0}
    .grand{font-weight:700;font-size:15px;border-top:2px solid #111827;padding-top:6px;margin-top:6px}
    .footer{text-align:center;color:#6b7280;font-size:11px;margin-top:18px;line-height:1.6}
    .footer a{color:#0f766e;text-decoration:none}
    @media print{body{background:#fff;padding:0}.receipt{box-shadow:none;max-width:80mm;padding:8px}}
  </style>
</head>
<body>
  <div class="receipt">
    <h1>${esc(shop?.name ?? "Pointify POS")}</h1>
    ${shop?.address ? `<p class="muted">${esc(shop.address)}</p>` : ""}
    ${shop?.phone ? `<p class="muted">Tel: ${esc(shop.phone)}</p>` : ""}
    <hr class="divider" />
    <div class="row"><span>Receipt</span><span>${esc(sale.receiptNo ?? `#${sale.id}`)}</span></div>
    <div class="row"><span>Date</span><span>${esc(date)}</span></div>
    ${cust?.name ? `<div class="row"><span>Customer</span><span>${esc(cust.name)}</span></div>` : ""}
    <hr class="divider" />
    <table>
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
      <tbody>${itemsHtml || `<tr><td colspan="4" class="muted">No items</td></tr>`}</tbody>
    </table>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>KES ${fmt(sale.totalAmount)}</span></div>
      ${Number(sale.saleDiscount) > 0 ? `<div class="row"><span>Discount</span><span>-KES ${fmt(sale.saleDiscount)}</span></div>` : ""}
      ${Number(sale.totalTax) > 0 ? `<div class="row"><span>Tax</span><span>KES ${fmt(sale.totalTax)}</span></div>` : ""}
      <div class="row grand"><span>Total</span><span>KES ${fmt(sale.totalWithDiscount ?? sale.totalAmount)}</span></div>
      ${paymentsHtml ? `<hr class="divider" />${paymentsHtml}` : ""}
      ${Number(sale.outstandingBalance) > 0 ? `<div class="row" style="color:#b91c1c"><span>Balance due</span><span>KES ${fmt(sale.outstandingBalance)}</span></div>` : ""}
    </div>
    <hr class="divider" />
    <div class="footer">
      Thank you for your purchase!<br/>
      Powered by <a href="https://pointifypos.com">pointifypos.com</a><br/>
      +254 791 334 234
    </div>
  </div>
</body>
</html>`);
});

function notFoundHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Receipt not found</title>
  <style>body{font-family:system-ui;background:#f1f5f9;display:grid;place-items:center;min-height:100vh;margin:0;color:#374151}
  .card{background:#fff;padding:32px 40px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.08);text-align:center;max-width:360px}
  h1{margin:0 0 8px;font-size:20px}p{margin:0;color:#6b7280;font-size:14px}a{color:#0f766e}</style></head>
  <body><div class="card"><h1>Receipt not found</h1><p>This link is invalid or has expired.<br/>Visit <a href="https://pointifypos.com">pointifypos.com</a> for help.</p></div></body></html>`;
}

export default router;
