// Gateway dispatcher — picks the right adapter based on the
// `payment_gateways.gateway` column and forwards the call. To add a new
// gateway: implement GatewayAdapter, import it here, and add it to ADAPTERS.
import { eq } from "drizzle-orm";
import { paymentGateways, type PaymentGateway } from "@workspace/db";
import { db } from "../db.js";
import type { GatewayAdapter, ChargeArgs, ChargeResult, StatusResult } from "./types.js";
import { sunpayAdapter } from "./sunpay.js";

const ADAPTERS: Record<string, GatewayAdapter> = {
  sunpay: sunpayAdapter,
  // stripe:   stripeAdapter,    // future
  // paystack: paystackAdapter,  // future
  // mpesa:    darajaAdapter,    // future (raw Safaricom Daraja)
};

export const SUPPORTED_GATEWAYS = Object.keys(ADAPTERS);

export function getAdapter(gateway: string): GatewayAdapter | null {
  return ADAPTERS[gateway] ?? null;
}

export type LoadedGateway = PaymentGateway & { adapter: GatewayAdapter };

// Resolve a payment_gateways row and pair it with its adapter. Returns null
// if the row is missing/inactive or the gateway has no registered adapter.
export async function loadGateway(gatewayId: number): Promise<LoadedGateway | null> {
  const row = await db.query.paymentGateways.findFirst({ where: eq(paymentGateways.id, gatewayId) });
  if (!row || !row.isActive) return null;
  const adapter = getAdapter(row.gateway);
  if (!adapter) return null;
  return { ...row, adapter };
}

export async function chargeWithGateway(gatewayId: number, args: ChargeArgs): Promise<ChargeResult & { paymentGatewayId?: number; gateway?: string }> {
  const g = await loadGateway(gatewayId);
  if (!g) return { ok: false, status: "failed", message: "payment gateway not found, inactive, or unsupported" };
  const out = await g.adapter.charge(g.config as Record<string, unknown>, args);
  return { ...out, paymentGatewayId: g.id, gateway: g.gateway };
}

export async function getStatusWithGateway(gatewayId: number, transactionId: string): Promise<StatusResult> {
  const g = await loadGateway(gatewayId);
  if (!g) return { ok: false, message: "payment gateway not found" };
  if (!g.adapter.getStatus) return { ok: false, message: `${g.gateway} adapter does not support status polling` };
  return g.adapter.getStatus(g.config as Record<string, unknown>, transactionId);
}

export type { ChargeArgs, ChargeResult, StatusResult, GatewayAdapter };
