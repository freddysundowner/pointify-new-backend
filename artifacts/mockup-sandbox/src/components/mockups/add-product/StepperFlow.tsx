import { useState } from "react";
import {
  ShoppingCart, Tag, Layers, ArrowLeft, Check,
  ChevronRight, Package, DollarSign, Plus, ChevronDown
} from "lucide-react";

type Step = 1 | 2 | 3;
type ProductType = "product" | "service" | "virtual";

function StepIndicator({ step, current }: { step: number; current: Step }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
        done ? "bg-violet-600 text-white" : active ? "bg-violet-600 text-white ring-4 ring-violet-100" : "bg-gray-100 text-gray-400"
      }`}>
        {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : step}
      </div>
      <span className={`text-sm font-medium ${active ? "text-gray-800" : done ? "text-gray-500" : "text-gray-400"}`}>
        {step === 1 ? "Basics" : step === 2 ? "Pricing" : "Details"}
      </span>
    </div>
  );
}

function Connector({ done }: { done: boolean }) {
  return <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${done ? "bg-violet-500" : "bg-gray-100"}`} />;
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {text}{required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
  );
}

function Input({ placeholder, type = "text", prefix }: { placeholder?: string; type?: string; prefix?: string }) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-0 inset-y-0 flex items-center pl-3.5 text-sm font-medium text-gray-400 pointer-events-none">{prefix}</span>
      )}
      <input
        type={type}
        placeholder={placeholder}
        className={`w-full h-11 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all ${prefix ? "pl-12" : "px-3.5"} pr-3.5`}
      />
    </div>
  );
}

function Select({ placeholder, options }: { placeholder: string; options: string[] }) {
  return (
    <div className="relative">
      <select className="w-full h-11 rounded-xl border border-gray-200 bg-white text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all px-3.5 appearance-none cursor-pointer">
        <option>{placeholder}</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function CheckItem({ label, desc, checked, onToggle }: { label: string; desc: string; checked: boolean; onToggle: () => void }) {
  return (
    <label onClick={onToggle} className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50/50 cursor-pointer hover:bg-gray-50 transition-colors">
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${checked ? "bg-violet-600 border-violet-600" : "border-gray-300 bg-white"}`}>
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
    </label>
  );
}

export function StepperFlow() {
  const [step, setStep] = useState<Step>(1);
  const [productType, setProductType] = useState<ProductType>("product");
  const [isTaxable, setIsTaxable] = useState(false);
  const [isBundle, setIsBundle] = useState(false);
  const [manageByPrice, setManageByPrice] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f5f8] font-['Inter']">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />

      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            <button className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors font-medium">
              <ArrowLeft className="h-4 w-4" />
              Products
            </button>
            <span className="text-gray-300">/</span>
            <span className="font-semibold text-gray-800">New Product</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            Step {step} of 3
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center">
          <StepIndicator step={1} current={step} />
          <Connector done={step > 1} />
          <StepIndicator step={2} current={step} />
          <Connector done={step > 2} />
          <StepIndicator step={3} current={step} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-6">

        {/* Step 1: Basics */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Product type */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-1">What are you adding?</h2>
                <p className="text-sm text-gray-400">Choose the type of item you're creating.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: "product", label: "Physical Product", icon: ShoppingCart, desc: "Track stock & inventory" },
                  { value: "service", label: "Service", icon: Tag, desc: "No stock tracking" },
                  { value: "virtual", label: "Virtual Item", icon: Layers, desc: "Digital / non-physical" },
                ] as { value: ProductType; label: string; icon: any; desc: string }[]).map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => setProductType(value)}
                    className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                      productType === value
                        ? "border-violet-500 bg-violet-50"
                        : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${productType === value ? "bg-violet-600" : "bg-gray-100"}`}>
                      <Icon className={`h-4 w-4 ${productType === value ? "text-white" : "text-gray-500"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${productType === value ? "text-violet-700" : "text-gray-700"}`}>{label}</p>
                      <p className={`text-xs mt-0.5 ${productType === value ? "text-violet-500" : "text-gray-400"}`}>{desc}</p>
                    </div>
                    {productType === value && (
                      <div className="absolute top-3 right-3">
                        <div className="w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Name & unit */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-800">Basic Info</h2>
              <div>
                <Label text={productType === "service" ? "Service Name" : "Product Name"} required />
                <Input placeholder={productType === "service" ? "e.g. Delivery, Tailoring…" : "e.g. Blue T-Shirt, 1kg Rice…"} />
              </div>
              {productType === "product" && (
                <div>
                  <Label text="Unit of Measure" />
                  <Input placeholder="e.g. kg, pcs, liters, boxes" />
                  <p className="text-xs text-gray-400 mt-1.5">How this product is measured or counted</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Pricing */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-1">Pricing & Quantity</h2>
                <p className="text-sm text-gray-400">Set how this product is priced and how many you have.</p>
              </div>

              {/* How to sell */}
              <div className="space-y-3">
                <Label text="How is this priced?" />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setManageByPrice(false)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${!manageByPrice ? "border-violet-500 bg-violet-50" : "border-gray-100 hover:border-gray-200"}`}
                  >
                    <p className={`text-sm font-semibold ${!manageByPrice ? "text-violet-700" : "text-gray-700"}`}>Fixed Price</p>
                    <p className={`text-xs mt-0.5 ${!manageByPrice ? "text-violet-500" : "text-gray-400"}`}>Set a price now</p>
                  </button>
                  <button
                    onClick={() => setManageByPrice(true)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${manageByPrice ? "border-violet-500 bg-violet-50" : "border-gray-100 hover:border-gray-200"}`}
                  >
                    <p className={`text-sm font-semibold ${manageByPrice ? "text-violet-700" : "text-gray-700"}`}>Open Price</p>
                    <p className={`text-xs mt-0.5 ${manageByPrice ? "text-violet-500" : "text-gray-400"}`}>Cashier enters amount at sale</p>
                  </button>
                </div>
              </div>

              {!manageByPrice && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label text="Selling Price" required />
                    <Input type="number" placeholder="0.00" prefix="KES" />
                  </div>
                  {productType === "product" && (
                    <div>
                      <Label text="Buying / Cost Price" />
                      <Input type="number" placeholder="0.00" prefix="KES" />
                    </div>
                  )}
                </div>
              )}

              {productType === "product" && (
                <div>
                  <Label text="Initial Stock Quantity" />
                  <Input type="number" placeholder="0" />
                  <p className="text-xs text-gray-400 mt-1.5">How many units do you have in stock right now?</p>
                </div>
              )}
            </div>

            {/* Tax & settings */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
              <h2 className="text-base font-semibold text-gray-800 mb-1">Additional Settings</h2>
              <CheckItem
                label="Taxable product"
                desc="Tax will be applied at checkout"
                checked={isTaxable}
                onToggle={() => setIsTaxable(v => !v)}
              />
              <CheckItem
                label="Bundle product"
                desc="This item contains multiple products"
                checked={isBundle}
                onToggle={() => setIsBundle(v => !v)}
              />
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-1">Product Details</h2>
                <p className="text-sm text-gray-400">All of these are optional — add what's relevant.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label text="Barcode" />
                  <Input placeholder="e.g. 1234567890128" />
                </div>
                <div>
                  <Label text="Category" />
                  <Select placeholder="Select category" options={["Beverages", "Clothing", "Electronics", "Food"]} />
                </div>
              </div>

              <div>
                <Label text="Description" />
                <textarea
                  placeholder="Describe this product…"
                  className="w-full rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all px-3.5 py-2.5 min-h-[90px] resize-none"
                />
              </div>

              {productType === "product" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label text="Manufacturer" />
                      <Input placeholder="e.g. Samsung, Nike…" />
                    </div>
                    <div>
                      <Label text="Supplier" />
                      <Select placeholder="Select supplier" options={["Supplier A", "Supplier B"]} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label text="Wholesale Price" />
                      <Input type="number" placeholder="0.00" prefix="KES" />
                    </div>
                    <div>
                      <Label text="Dealer Price" />
                      <Input type="number" placeholder="0.00" prefix="KES" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label text="Reorder Level" />
                      <Input type="number" placeholder="0" />
                      <p className="text-xs text-gray-400 mt-1.5">Alert when stock drops below this</p>
                    </div>
                    <div>
                      <Label text="Expiry Date" />
                      <Input type="date" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => step > 1 && setStep(s => (s - 1) as Step)}
            className={`flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-medium transition-all ${
              step === 1 ? "invisible" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(s => (s + 1) as Step)}
              className="flex items-center gap-2 h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all shadow-sm shadow-violet-200"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button className="flex items-center gap-2 h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all shadow-sm shadow-violet-200">
              <Check className="h-4 w-4" />
              Save Product
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
