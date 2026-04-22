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

// Catalog of supported gateways for the admin UI. Each entry advertises
// the credential fields the adapter expects so the frontend can render
// the right form when a super-admin picks a gateway type.
export interface GatewayConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  required: boolean;
  placeholder?: string;
  help?: string;
}
export interface GatewayCatalogEntry {
  gateway: string;
  label: string;
  description: string;
  configFields: GatewayConfigField[];
}
export const GATEWAY_CATALOG: GatewayCatalogEntry[] = [
  {
    gateway: "sunpay",
    label: "SunPay (M-Pesa STK push)",
    description: "Charges M-Pesa numbers via SunPay's STK push API. Used for SMS credit top-ups and admin subscription payments.",
    configFields: [
      { key: "apiKey",        label: "API key",        type: "password", required: true,  placeholder: "sk_live_…", help: "Your SunPay merchant API key. Required." },
      { key: "baseUrl",       label: "API base URL",   type: "url",      required: false, placeholder: "https://api.sunpay.co.ke/api/v1", help: "Override only if SunPay gives you a different host." },
      { key: "webhookSecret", label: "Webhook secret", type: "password", required: false, help: "If set, incoming SunPay webhooks must carry an HMAC-SHA256 of the raw body in the x-webhook-signature header." },
    ],
  },
];

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
