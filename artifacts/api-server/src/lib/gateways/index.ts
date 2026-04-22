// Gateway dispatcher — picks the right adapter based on the
// `payment_methods.gateway` column and forwards the call. To add a new
// gateway: implement GatewayAdapter, import it here, and add it to ADAPTERS.
import { eq } from "drizzle-orm";
import { paymentMethods, type PaymentMethod } from "@workspace/db";
import { db } from "../db.js";
import type { GatewayAdapter, ChargeArgs, ChargeResult, StatusResult } from "./types.js";
import { sunpayAdapter } from "./sunpay.js";

const ADAPTERS: Record<string, GatewayAdapter> = {
  sunpay: sunpayAdapter,
  // stripe:   stripeAdapter,    // future
  // paystack: paystackAdapter,  // future
  // mpesa:    darajaAdapter,    // future (raw Safaricom Daraja)
};

export const SUPPORTED_GATEWAYS = ["manual", ...Object.keys(ADAPTERS)] as const;

export function getAdapter(gateway: string): GatewayAdapter | null {
  return ADAPTERS[gateway] ?? null;
}

export type LoadedMethod = PaymentMethod & { adapter: GatewayAdapter };

// Resolve a payment_methods row and pair it with its adapter. Returns null if
// the row is missing/inactive or the gateway has no adapter (e.g. "manual").
export async function loadMethod(methodId: number): Promise<LoadedMethod | null> {
  const row = await db.query.paymentMethods.findFirst({ where: eq(paymentMethods.id, methodId) });
  if (!row || !row.isActive) return null;
  const adapter = getAdapter(row.gateway);
  if (!adapter) return null;
  return { ...row, adapter };
}

export async function chargeWithMethod(methodId: number, args: ChargeArgs): Promise<ChargeResult & { paymentMethodId?: number; gateway?: string }> {
  const m = await loadMethod(methodId);
  if (!m) return { ok: false, status: "failed", message: "payment method not found, inactive, or unsupported gateway" };
  const out = await m.adapter.charge(m.config as Record<string, unknown>, args);
  return { ...out, paymentMethodId: m.id, gateway: m.gateway };
}

export async function getStatusWithMethod(methodId: number, transactionId: string): Promise<StatusResult> {
  const m = await loadMethod(methodId);
  if (!m) return { ok: false, message: "payment method not found" };
  if (!m.adapter.getStatus) return { ok: false, message: `${m.gateway} adapter does not support status polling` };
  return m.adapter.getStatus(m.config as Record<string, unknown>, transactionId);
}

export async function verifyWebhookForMethod(methodId: number, rawBody: Buffer | string, signatureHeader: string | undefined): Promise<boolean> {
  const m = await loadMethod(methodId);
  if (!m) return false;
  if (!m.adapter.verifyWebhook) return true;
  return m.adapter.verifyWebhook(m.config as Record<string, unknown>, rawBody, signatureHeader);
}

export type { ChargeArgs, ChargeResult, StatusResult, GatewayAdapter };
