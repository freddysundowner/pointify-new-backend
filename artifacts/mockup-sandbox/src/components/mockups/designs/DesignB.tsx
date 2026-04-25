export default function DesignB() {
  const nav = [
    { icon: "⊞", label: "Dashboard", active: true },
    { icon: "🧾", label: "Sales" },
    { icon: "📦", label: "Products" },
    { icon: "👥", label: "Customers" },
    { icon: "👤", label: "Attendants" },
    { icon: "📊", label: "Reports" },
    { icon: "⚙️", label: "Settings" },
  ];
  const stats = [
    { label: "Total Revenue", value: "84,320", unit: "KSh", icon: "💰", color: "#6366f1", bg: "#eef2ff" },
    { label: "Net Profit", value: "21,080", unit: "KSh", icon: "📈", color: "#0ea5e9", bg: "#e0f2fe" },
    { label: "Expenses", value: "6,240", unit: "KSh", icon: "💸", color: "#f43f5e", bg: "#fff1f2" },
    { label: "Transactions", value: "143", unit: "", icon: "🔁", color: "#10b981", bg: "#ecfdf5" },
  ];
  const sales = [
    { id: "0041", customer: "Alice Wanjiru", amount: "1,200", method: "M-Pesa", status: "paid" },
    { id: "0040", customer: "Brian Otieno", amount: "450", method: "Cash", status: "paid" },
    { id: "0039", customer: "Carol Mwangi", amount: "3,750", method: "Card", status: "paid" },
    { id: "0038", customer: "David Kamau", amount: "900", method: "M-Pesa", status: "paid" },
    { id: "0037", customer: "Eva Njeri", amount: "2,200", method: "Credit", status: "partial" },
  ];
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#f5f5f7" }} className="flex h-screen overflow-hidden">
      {/* Sidebar — slim icon+label */}
      <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col shadow-sm">
        <div className="px-5 py-5">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs" style={{ background: "#6366f1" }}>P</div>
            <span className="font-bold text-gray-800 text-sm tracking-tight">Pointify</span>
          </div>
          {nav.map((item) => (
            <div key={item.label}
              className="flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm cursor-pointer"
              style={item.active ? { background: "#eef2ff", color: "#6366f1", fontWeight: 600 } : { color: "#6b7280" }}>
              <span>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
        <div className="mt-auto p-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "#6366f1" }}>JM</div>
            <div>
              <p className="text-gray-700 text-xs font-semibold">James Mwangi</p>
              <p className="text-gray-400 text-xs">Owner</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 w-64 text-sm text-gray-400">
              🔍 <span>Search sales, customers…</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 text-sm text-gray-600 cursor-pointer">
            🏪 Main Branch ▾
          </div>
          <button className="text-sm font-semibold text-white px-4 py-1.5 rounded-xl shadow-sm" style={{ background: "#6366f1" }}>
            + New Sale
          </button>
          <div className="text-gray-400 text-lg relative cursor-pointer">
            🔔
            <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500" />
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-gray-900 font-bold text-xl">Good morning, James 👋</h1>
              <p className="text-gray-400 text-sm mt-0.5">Here's what's happening at your shop today.</p>
            </div>
            <span className="text-gray-400 text-sm">Saturday, 25 Apr 2026</span>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {stats.map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-3" style={{ background: s.bg }}>
                  {s.icon}
                </div>
                <p className="text-gray-400 text-xs mb-1">{s.label}</p>
                <p className="font-bold text-gray-900 text-xl">{s.unit && <span className="text-sm font-normal text-gray-400 mr-1">{s.unit}</span>}{s.value}</p>
              </div>
            ))}
          </div>

          {/* Two-column row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Margin card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                <p className="text-gray-400 text-xs mb-1">Profit Margin</p>
                <p className="font-bold text-gray-900 text-3xl">25%</p>
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width: "25%", background: "#6366f1" }} />
                </div>
                <p className="text-gray-400 text-xs mt-2">Target: 35%</p>
              </div>
            </div>
            {/* Overdue */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-gray-400 text-xs mb-3">Overdue Balances</p>
              <p className="font-bold text-red-500 text-2xl mb-1">KSh 4,800</p>
              <p className="text-gray-400 text-xs">Across 3 customers</p>
              <div className="mt-4 space-y-2">
                {["Eva Njeri — KSh 800", "Tom Karanja — KSh 2,400", "Mary Wahu — KSh 1,600"].map((c) => (
                  <div key={c} className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    {c}
                  </div>
                ))}
              </div>
            </div>
            {/* Quick actions */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-gray-400 text-xs mb-3">Quick Actions</p>
              <div className="space-y-2">
                {[
                  { label: "Open POS", icon: "🖥️", primary: true },
                  { label: "Add Product", icon: "📦", primary: false },
                  { label: "View Reports", icon: "📊", primary: false },
                ].map((a) => (
                  <button key={a.label} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border"
                    style={a.primary ? { background: "#6366f1", color: "white", borderColor: "#6366f1" } : { background: "white", color: "#374151", borderColor: "#e5e7eb" }}>
                    {a.icon} {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sales table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="font-semibold text-gray-800 text-sm">Recent Transactions</p>
              <span className="text-xs font-medium cursor-pointer" style={{ color: "#6366f1" }}>View all</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {sales.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-600 bg-indigo-50">#{s.id.slice(-2)}</div>
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-700">{s.customer}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs">{s.method}</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-800">KSh {s.amount}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.status === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"}`}>
                        {s.status === "paid" ? "Paid" : "Partial"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
