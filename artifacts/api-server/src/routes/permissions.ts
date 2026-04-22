import { Router, type IRouter } from "express";
import { ok } from "../lib/response.js";
import { requireAdminOrAttendant } from "../middlewares/auth.js";

const router: IRouter = Router();

const PERMISSIONS = [
  {
    key: "pos",
    label: "POS",
    values: [
      "can_sell",
      "can_sell_to_dealer_&_wholesaler",
      "discount",
      "edit_price",
      "set_sale_date",
    ],
    condition: null,
  },
  {
    key: "stocks",
    label: "Stocks",
    values: [
      "view_products",
      "add_products",
      "view_buying_price",
      "stock_summary",
      "view_purchases",
      "add_purchases",
      "stock_count",
      "badstock",
      "transfer",
      "return",
      "delete_purchase_invoice",
    ],
    condition: null,
  },
  {
    key: "products",
    label: "Products",
    values: ["add", "edit", "delete", "adjust_stock", "view_adjustment_history"],
    condition: null,
  },
  {
    key: "sales",
    label: "Sales",
    values: ["view_sales", "return", "delete", "view_profit"],
    condition: null,
  },
  {
    key: "reports",
    label: "Reports",
    values: [
      "sales",
      "dues",
      "productsales",
      "discoutedsales",
      "debtors",
      "purchases",
      "expenses",
      "stocktake",
      "netprofit",
      "stockreport",
      "productmovement",
      "profitanalysis",
    ],
    condition: null,
  },
  { key: "purchases", label: "Purchases", values: ["edit_buying_price"], condition: null },
  { key: "accounts", label: "Accounts", values: ["cashflow"], condition: null },
  { key: "expenses", label: "Expenses", values: ["manage"], condition: null },
  { key: "suppliers", label: "Suppliers", values: ["manage"], condition: null },
  { key: "customers", label: "Customers", values: ["manage", "deposit"], condition: null },
  { key: "shop", label: "Shop", values: ["manage", "switch"], condition: null },
  { key: "attendants", label: "Attendants", values: ["manage", "view"], condition: null },
  { key: "usage", label: "Usage", values: ["manage"], condition: null },
  { key: "support", label: "Support", values: ["manage"], condition: null },
  {
    key: "production",
    label: "Production",
    values: ["delete", "change_status", "edit", "adjust_stock", "view_adjustment_history"],
    condition: "production",
  },
  {
    key: "warehouse",
    label: "Warehouse",
    values: [
      "invoice_delete",
      "show_buying_price",
      "show_available_stock",
      "view_buying_price",
      "create_orders",
      "view_orders",
      "return",
      "accept_warehouse_orders",
    ],
    condition: "warehouse",
  },
];

router.get("/", requireAdminOrAttendant, (_req, res) => {
  return ok(res, PERMISSIONS);
});

export default router;
