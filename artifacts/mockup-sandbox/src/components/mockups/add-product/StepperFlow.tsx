import { useState } from "react";
import { ShoppingCart, Tag, Layers, ArrowLeft, Check, Plus, X, ChevronDown } from "lucide-react";

type ProductType = "product" | "service" | "virtual";

const EXTRA_FIELDS = [
  { key: "barcode", label: "Barcode", types: ["product", "service", "virtual"] },
  { key: "category", label: "Category", types: ["product", "service", "virtual"] },
  { key: "description", label: "Description", types: ["product", "service", "virtual"] },
  { key: "supplier", label: "Supplier", types: ["product"] },
  { key: "wholesale", label: "Wholesale Price", types: ["product"] },
  { key: "reorder", label: "Reorder Level", types: ["product"] },
  { key: "expiry", label: "Expiry Date", types: ["product"] },
];

export function StepperFlow() {
  const [type, setType] = useState<ProductType>("product");
  const [isTaxable, setIsTaxable] = useState(false);
  const [active, setActive] = useState<Record<string, boolean>>({});

  const toggle = (k: string) => setActive(p => ({ ...p, [k]: !p[k] }));
  const available = EXTRA_FIELDS.filter(f => f.types.includes(type));

  return (
    <div className="min-h-screen bg-gray-50 font-['Inter']">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" />

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors">
          <ArrowLeft className="h-4 w-4" /> Products
        </button>
        <div className="flex gap-2">
          <button className="h-9 px-4 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button className="h-9 px-5 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors">Save Product</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-7 space-y-4">

        {/* Type picker */}
        <div className="bg-white rounded-2xl border border-gray-100 p-1 flex gap-1 shadow-sm">
          {(["product", "service", "virtual"] as ProductType[]).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all capitalize ${
                type === t ? "bg-violet-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "product" && <ShoppingCart className="h-3.5 w-3.5" />}
              {t === "service" && <Tag className="h-3.5 w-3.5" />}
              {t === "virtual" && <Layers className="h-3.5 w-3.5" />}
              {t}
            </button>
          ))}
        </div>

        {/* Main form card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">

          {/* Name */}
          <div className="px-5 py-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {type === "service" ? "Service Name" : "Product Name"} <span className="text-rose-500">*</span>
            </label>
            <input
              placeholder={type === "service" ? "e.g. Delivery, Haircut…" : "e.g. Blue T-Shirt, 1kg Rice…"}
              className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all"
            />
          </div>

          {/* Prices */}
          <div className="px-5 py-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Selling Price <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">KES</span>
                <input type="number" placeholder="0.00" className="w-full h-10 rounded-lg border border-gray-200 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all" />
              </div>
            </div>
            {type === "product" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Buying Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">KES</span>
                  <input type="number" placeholder="0.00" className="w-full h-10 rounded-lg border border-gray-200 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all" />
                </div>
              </div>
            )}
          </div>

          {/* Quantity (product only) */}
          {type === "product" && (
            <div className="px-5 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Initial Quantity</label>
              <input type="number" placeholder="0" className="w-40 h-10 rounded-lg border border-gray-200 px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all" />
            </div>
          )}

          {/* Taxable */}
          <label
            className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/60 transition-colors"
            onClick={() => setIsTaxable(v => !v)}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isTaxable ? "bg-violet-600 border-violet-600" : "border-gray-300 bg-white"}`}>
              {isTaxable && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Taxable product</p>
              <p className="text-xs text-gray-400 mt-0.5">Tax will be applied at checkout</p>
            </div>
          </label>
        </div>

        {/* Extra fields (expanded) */}
        {available.filter(f => active[f.key]).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {available.filter(f => active[f.key]).map(field => (
              <div key={field.key} className="px-5 py-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">{field.label}</label>
                  <button onClick={() => toggle(field.key)} className="text-gray-300 hover:text-gray-400 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {field.key === "description" ? (
                  <textarea placeholder="Optional description…" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all min-h-[80px] resize-none" />
                ) : field.key === "category" ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all appearance-none cursor-pointer">
                        <option>Select category</option>
                        <option>Beverages</option>
                        <option>Clothing</option>
                        <option>Electronics</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                    <button className="h-10 w-10 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0">
                      <Plus className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                ) : field.key === "expiry" ? (
                  <input type="date" className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all" />
                ) : (
                  <div className="relative">
                    {(field.key === "wholesale") && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">KES</span>}
                    <input
                      type={["wholesale", "reorder"].includes(field.key) ? "number" : "text"}
                      placeholder={field.key === "barcode" ? "e.g. 1234567890128" : field.key === "reorder" ? "0" : ""}
                      className={`w-full h-10 rounded-lg border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all pr-3 ${field.key === "wholesale" ? "pl-10" : "px-3"}`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add extras chips */}
        {available.filter(f => !active[f.key]).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {available.filter(f => !active[f.key]).map(f => (
              <button
                key={f.key}
                onClick={() => toggle(f.key)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
              >
                <Plus className="h-3 w-3" /> {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
