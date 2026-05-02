import { useState } from "react";
import {
  ShoppingCart, Tag, Layers, ArrowLeft, Package, DollarSign,
  Barcode, AlignLeft, Building2, Hash, Users, Store, TrendingDown,
  Calendar, AlertCircle, ChevronDown, Plus, X, Check
} from "lucide-react";

type ProductType = "product" | "service" | "virtual";

const OPTIONAL_FIELDS = [
  { key: "barcode", label: "Barcode", icon: Barcode, types: ["product", "service", "virtual"] },
  { key: "description", label: "Description", icon: AlignLeft, types: ["product", "service", "virtual"] },
  { key: "category", label: "Category", icon: Tag, types: ["product", "service", "virtual"] },
  { key: "supplier", label: "Supplier", icon: Building2, types: ["product"] },
  { key: "manufacturer", label: "Manufacturer", icon: Building2, types: ["product"] },
  { key: "serialnumber", label: "Serial No.", icon: Hash, types: ["product"] },
  { key: "wholesale", label: "Wholesale Price", icon: Users, types: ["product"] },
  { key: "dealer", label: "Dealer Price", icon: Store, types: ["product"] },
  { key: "minprice", label: "Min Price", icon: TrendingDown, types: ["product", "service"] },
  { key: "maxdiscount", label: "Max Discount", icon: TrendingDown, types: ["product", "service"] },
  { key: "reorder", label: "Reorder Level", icon: AlertCircle, types: ["product"] },
  { key: "expiry", label: "Expiry Date", icon: Calendar, types: ["product"] },
];

function Field({ label, hint, required, placeholder, type = "text", addon }: {
  label: string; hint?: string; required?: boolean; placeholder?: string; type?: string; addon?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {addon && (
          <span className="absolute left-0 inset-y-0 flex items-center pl-3 text-gray-400 text-sm pointer-events-none">{addon}</span>
        )}
        <input
          type={type}
          placeholder={placeholder}
          className={`w-full h-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all ${addon ? "pl-8" : "px-3"} pr-3`}
        />
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function PriceField({ label, required, hint }: { label: string; required?: boolean; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">KES</span>
        <input
          type="number"
          placeholder="0.00"
          className="w-full h-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all pl-12 pr-3"
        />
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function SectionedCard() {
  const [productType, setProductType] = useState<ProductType>("product");
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [isBundle, setIsBundle] = useState(false);
  const [isTaxable, setIsTaxable] = useState(false);

  const toggle = (key: string) => setActive(p => ({ ...p, [key]: !p[key] }));

  const availableFields = OPTIONAL_FIELDS.filter(f => f.types.includes(productType));
  const inactiveFields = availableFields.filter(f => !active[f.key]);

  return (
    <div className="min-h-screen bg-[#f5f5f8] font-['Inter']">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />

      {/* Top header bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <button className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors font-medium">
            <ArrowLeft className="h-4 w-4" />
            Products
          </button>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-gray-800">New Product</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-9 px-4 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button className="h-9 px-5 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors shadow-sm shadow-violet-200">
            Save Product
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-3 gap-5">

        {/* ── LEFT: Main form ── */}
        <div className="col-span-2 space-y-4">

          {/* Type selector */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 inline-flex gap-1">
            {(["product", "service", "virtual"] as ProductType[]).map(t => (
              <button
                key={t}
                onClick={() => setProductType(t)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                  productType === t
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {t === "product" && <ShoppingCart className="h-3.5 w-3.5" />}
                {t === "service" && <Tag className="h-3.5 w-3.5" />}
                {t === "virtual" && <Layers className="h-3.5 w-3.5" />}
                {t}
              </button>
            ))}
          </div>

          {/* Core details */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                <Package className="h-4 w-4 text-violet-600" />
              </div>
              <h2 className="font-semibold text-gray-800 text-sm">
                {productType === "service" ? "Service Details" : "Product Details"}
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <Field
                label={productType === "service" ? "Service Name" : "Product Name"}
                required
                placeholder={productType === "service" ? "e.g. Delivery, Tailoring…" : "e.g. Blue T-Shirt, 1kg Rice…"}
              />
              {productType === "product" && (
                <Field label="Unit of Measure" placeholder="e.g. kg, pcs, liters, boxes" />
              )}

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <PriceField label={productType === "service" ? "Rate / Price" : "Selling Price"} required />
                {productType === "product" && !isBundle && (
                  <PriceField label="Buying Price" hint="Used for profit tracking" />
                )}
              </div>

              {productType === "product" && (
                <Field label="Initial Quantity" type="number" placeholder="0" />
              )}

              {/* Taxable */}
              <label className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <div
                  onClick={() => setIsTaxable(v => !v)}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all flex-shrink-0 ${
                    isTaxable ? "bg-violet-600 border-violet-600" : "border-gray-300 bg-white"
                  }`}
                >
                  {isTaxable && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Taxable product</p>
                  <p className="text-xs text-gray-400 mt-0.5">Tax will be applied at checkout</p>
                </div>
              </label>
            </div>
          </div>

          {/* Optional fields (expanded) */}
          {availableFields.filter(f => active[f.key]).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50">
                <h2 className="font-semibold text-gray-800 text-sm">Additional Details</h2>
              </div>
              <div className="p-5 space-y-5">
                {availableFields.filter(f => active[f.key]).map(field => (
                  <div key={field.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <field.icon className="h-3.5 w-3.5 text-gray-400" />
                        {field.label}
                      </label>
                      <button onClick={() => toggle(field.key)} className="text-gray-300 hover:text-gray-500 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {field.key === "description" ? (
                      <textarea
                        placeholder="Describe this product…"
                        className="w-full rounded-lg border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all px-3 py-2 min-h-[80px] resize-none"
                      />
                    ) : field.key === "expiry" ? (
                      <input type="date" className="w-full h-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all px-3" />
                    ) : ["wholesale", "dealer", "minprice", "maxdiscount"].includes(field.key) ? (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">KES</span>
                        <input type="number" placeholder="0.00" className="w-full h-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all pl-12 pr-3" />
                      </div>
                    ) : field.key === "category" ? (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <select className="w-full h-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all px-3 appearance-none cursor-pointer">
                            <option>Select a category</option>
                            <option>Beverages</option>
                            <option>Clothing</option>
                            <option>Electronics</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        </div>
                        <button className="h-10 w-10 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                          <Plus className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                    ) : (
                      <input
                        type={field.key === "reorder" ? "number" : "text"}
                        placeholder={
                          field.key === "barcode" ? "e.g. 1234567890128"
                          : field.key === "manufacturer" ? "e.g. Samsung, Nike…"
                          : field.key === "serialnumber" ? "Enter serial number"
                          : field.key === "supplier" ? "Select a supplier"
                          : ""
                        }
                        className="w-full h-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all px-3"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add more fields */}
          {inactiveFields.length > 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 px-5 py-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Add more details</p>
              <div className="flex flex-wrap gap-2">
                {inactiveFields.map(field => (
                  <button
                    key={field.key}
                    onClick={() => toggle(field.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-all"
                  >
                    <Plus className="h-3 w-3" />
                    {field.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="space-y-4">

          {/* Product settings */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Settings</h3>
            </div>
            <div className="divide-y divide-gray-50">
              <label className="flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors">
                <div
                  onClick={() => setIsBundle(v => !v)}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all flex-shrink-0 mt-0.5 ${
                    isBundle ? "bg-violet-600 border-violet-600" : "border-gray-300 bg-white"
                  }`}
                >
                  {isBundle && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Bundle Product</p>
                  <p className="text-xs text-gray-400 mt-0.5">Contains multiple products</p>
                </div>
              </label>
              <label className="flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors">
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Sell by Price</p>
                  <p className="text-xs text-gray-400 mt-0.5">Cashier sets amount at sale</p>
                </div>
              </label>
            </div>
          </div>

          {/* Type hint card */}
          <div className={`rounded-xl px-5 py-4 border ${
            productType === "service"
              ? "bg-blue-50 border-blue-100"
              : productType === "virtual"
              ? "bg-emerald-50 border-emerald-100"
              : "bg-violet-50 border-violet-100"
          }`}>
            <p className={`text-sm font-semibold mb-1 ${
              productType === "service" ? "text-blue-700"
              : productType === "virtual" ? "text-emerald-700"
              : "text-violet-700"
            }`}>
              {productType === "service" ? "Service" : productType === "virtual" ? "Virtual Product" : "Physical Product"}
            </p>
            <p className={`text-xs leading-relaxed ${
              productType === "service" ? "text-blue-600"
              : productType === "virtual" ? "text-emerald-600"
              : "text-violet-600"
            }`}>
              {productType === "service"
                ? "A service you provide — no physical inventory tracked."
                : productType === "virtual"
                ? "A digital item with no physical stock requirements."
                : "Track inventory, set buying & selling prices, and manage stock levels."
              }
            </p>
          </div>

          {/* Quick tip */}
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-5 py-4">
            <p className="text-xs font-semibold text-amber-700 mb-1">Tip</p>
            <p className="text-xs text-amber-600 leading-relaxed">
              You can always add barcode, category, and other details later from the product listing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
