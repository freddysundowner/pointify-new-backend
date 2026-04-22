// Generic payment-gateway interface. Every adapter (SunPay, Stripe, Paystack,
// raw Daraja M-Pesa, …) implements this so the rest of the app stays gateway-
// agnostic and just hands a `payment_methods` row to the dispatcher.

export interface ChargeArgs {
  amount: number;             // KES (or method's currency) — minor units NOT used
  currency?: string;          // defaults to "KES"
  externalRef: string;        // our internal reference; echoed back in callbacks
  phone?: string;             // required for STK-style methods (M-Pesa)
  email?: string;             // required for hosted-checkout methods (Stripe/Paystack)
  description?: string;
  callbackUrl?: string;       // per-transaction webhook URL
}

export interface ChargeResult {
  ok: boolean;
  // For async gateways (STK push, hosted checkout):
  status: "pending" | "completed" | "failed";
  // Provider-side identifiers — surface them to the client for polling/UX.
  transactionId?: string;
  checkoutRequestId?: string;
  checkoutUrl?: string;       // hosted-checkout redirect (Stripe/Paystack)
  message?: string;
  raw?: unknown;
}

export interface StatusResult {
  ok: boolean;
  status?: "pending" | "completed" | "failed" | string;
  amount?: string;
  reference?: string;         // gateway-side payment reference (e.g. M-Pesa code)
  message?: string;
  raw?: unknown;
}

// All adapters get the gateway's `config` jsonb from the payment_methods row.
export interface GatewayAdapter {
  // The string stored in `payment_methods.gateway` — e.g. "sunpay", "stripe".
  id: string;
  // Initiate a charge. For STK-push gateways this returns status="pending".
  charge(config: Record<string, unknown>, args: ChargeArgs): Promise<ChargeResult>;
  // Optional poll for current status of a previously-initiated charge.
  getStatus?(config: Record<string, unknown>, transactionId: string): Promise<StatusResult>;
  // Optional verifier for the gateway's signed webhook (HMAC, etc.).
  verifyWebhook?(config: Record<string, unknown>, rawBody: Buffer | string, signatureHeader: string | undefined): boolean;
}
