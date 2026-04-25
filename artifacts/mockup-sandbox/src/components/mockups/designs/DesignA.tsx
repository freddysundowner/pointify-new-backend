export default function DesignA() {
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
    { label: "Revenue", value: "KSh 84,320", change: "+12.4%", up: true, icon: "💰" },
    { label: "Net Profit", value: "KSh 21,080", change: "+8.1%", up: true, icon: "📈" },
    { label: "Expenses", value: "KSh 6,240", change: "-3.2%", up: false, icon: "💸" },
    { label: "Transactions", value: "143", change: "+5 today", up: true, icon: "🔁" },
  ];
  const sales = [
    { id: "#0041", customer: "Alice Wanjiru", items: 3, amount: "KSh 1,200", method: "M-Pesa", time: "2m ago" },
    { id: "#0040", customer: "Brian Otieno", items: 1, amount: "KSh 450", method: "Cash", time: "18m ago" },
    { id: "#0039", customer: "Carol Mwangi", items: 5, amount: "KSh 3,750", method: "Card", time: "34m ago" },
    { id: "#0038", customer: "David Kamau", items: 2, amount: "KSh 900", method: "M-Pesa", time: "1h ago" },
    { id: "#0037", customer: "Eva Njeri", items: 4, amount: "KSh 2,200", method: "Credit", time: "2h ago", owes: "KSh 800" },
  ];
  const methodColor: Record<string, string> = {
    "M-Pesa": "bg-emerald-100 text-emerald-700",
    "Cash": "bg-slate-100 text-slate-600",
    "Card": "bg-blue-100 text-blue-700",
    "Credit": "bg-orange-100 text-orange-700",
  };
  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: "#1e293b" }}>
        <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-700">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: "#10b981" }}>P</div>
          <span className="text-white font-semibold tracking-wide text-sm">Pointify</span>
        </div>
        <div className="px-3 pt-4 flex-1">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest px-3 mb-2">Menu</p>
          {nav.map((item) => (
            <div key={item.label} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 cursor-pointer text-sm ${item.active ? "text-white font-medium" : "text-slate-400 hover:text-slate-200"}`}
              style={item.active ? { background: "rgba(16,185,129,0.18)" } : {}}>
              <span className="text-base">{item.icon}</span>
              {item.label}
              {item.active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">JM</div>
            <div>
              <p className="text-white text-xs font-medium">James Mwangi</p>
              <p className="text-slate-500 text-xs">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-200 flex-shrink-0">
          <div>
            <h1 className="text-slate-800 font-semibold text-base">Dashboard</h1>
            <p className="text-slate-400 text-xs">Saturday, 25 April 2026</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 text-sm text-slate-500">
              <span>🔍</span> Search...
            </div>
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm">🔔</div>
              <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Shop selector */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 shadow-sm">
              🏪 <span className="font-medium">Main Branch</span> ▾
            </div>
            <button className="flex items-center gap-2 bg-emerald-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-emerald-600">
              + New Sale
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {stats.map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">{s.icon}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>{s.change}</span>
                </div>
                <p className="text-slate-500 text-xs mb-1">{s.label}</p>
                <p className="text-slate-800 font-bold text-lg">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Profit bar */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-700 font-semibold text-sm">Revenue vs Profit</p>
              <span className="text-xs text-slate-400">This month</span>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: "62%", background: "#10b981" }} />
              </div>
              <span className="text-xs text-slate-500 w-10 text-right">62%</span>
            </div>
            <div className="flex gap-4 text-xs text-slate-400 mt-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Revenue: KSh 84,320</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Profit: KSh 21,080</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-300 inline-block" /> Expenses: KSh 6,240</span>
            </div>
          </div>

          {/* Recent Sales */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="text-slate-700 font-semibold text-sm">Recent Sales</p>
              <span className="text-emerald-600 text-xs font-medium cursor-pointer">View all →</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3 text-left font-medium">Order</th>
                  <th className="px-5 py-3 text-left font-medium">Customer</th>
                  <th className="px-5 py-3 text-left font-medium">Items</th>
                  <th className="px-5 py-3 text-left font-medium">Amount</th>
                  <th className="px-5 py-3 text-left font-medium">Method</th>
                  <th className="px-5 py-3 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">{s.id}</td>
                    <td className="px-5 py-3 font-medium text-slate-700">{s.customer}</td>
                    <td className="px-5 py-3 text-slate-500">{s.items}</td>
                    <td className="px-5 py-3">
                      <span className="font-semibold text-slate-800">{s.amount}</span>
                      {s.owes && <p className="text-xs text-orange-500">Owes {s.owes}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${methodColor[s.method] || "bg-slate-100 text-slate-600"}`}>{s.method}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{s.time}</td>
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
