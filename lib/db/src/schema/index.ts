/**
 * Schema barrel export
 *
 * Import order follows the dependency chain so that nothing is used before it
 * is defined. Circular pairs (admins ↔ attendants) are handled inside their
 * own file using plain integer columns rather than .references().
 *
 * Domain grouping:
 *   system       → global lookup tables (no shop/admin scope)
 *   identity     → admins & attendants
 *   shop         → shops
 *   subscriptions → billing packages & subscriptions
 *   affiliates   → affiliate partners, awards, transactions
 *   customers    → shop customers
 *   suppliers    → product suppliers
 *   catalog      → product categories, products, batches, serials, inventory, adjustments, stock counts & requests
 *   orders       → customer orders (pre-sale intent)
 *   sales        → POS sales, payments, returns
 *   purchases    → supplier purchases, payments, returns
 *   transfers    → direct inter-shop stock moves
 *   finance      → expenses, cashflow, banks, general payments
 *   communication → email campaigns, audit activity log
 */

export * from "./system";
export * from "./identity";
export * from "./shop";
export * from "./subscriptions";
export * from "./affiliates";
export * from "./customers";
export * from "./suppliers";
export * from "./catalog";
export * from "./orders";
export * from "./sales";
export * from "./purchases";
export * from "./transfers";
export * from "./finance";
export * from "./communication";
