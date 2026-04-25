export default function DesignC() {
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
    { label: "Revenue", value: "KSh 84,320", delta: "+12.4%", up: true },
    { label: "Net Profit", value: "KSh 21,080", delta: "+8.1%", up: true },
    { label: "Expenses", value: "KSh 6,240", delta: "-3.2%", up: false },
    { label: "Transactions", value: "143", delta: "+5", up: true },
  ];
  const sales = [
    { id: "#0041", customer: "Alice Wanjiru", amount: "KSh 1,200", method: "M-Pesa", time: "2m ago" },
    { id: "#0040", customer: "Brian Otieno", amount: "KSh 450", method: "Cash", time: "18m ago" },
    { id: "#0039", customer: "Carol Mwangi", amount: "KSh 3,750", method: "Card", time: "34m ago" },
    { id: "#0038", customer: "David Kamau", amount: "KSh 900", method: "M-Pesa", time: "1h ago" },
    { id: "#0037", customer: "Eva Njeri", amount: "KSh 2,200", method: "Credit", time: "2h ago", owes: "KSh 800" },
  ];
  const methodPill: Record<string, string> = {
    "M-Pesa": "#065f46",
    "Cash": "#374151",
    "Card": "#1e3a8a",
    "Credit": "#7c2d12",
  };
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#0f172a", color: "#e2e8f0" }} className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: "#0f172a", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)" }}>P</div>
          <span className="font-bold text-white tracking-tight text-sm">Pointify</span>
        </div>
        <div className="p-3 flex-1">
          <p className="text-xs text-slate-600 uppercase tracking-widest px-3 mb-2 mt-1">Navigation</p>
          {nav.map((item) => (
            <div key={item.label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm cursor-pointer"
              style={item.active
                ? { background: "rgba(139,92,246,0.15)", color: "#a78bfa", fontWeight: 600 }
                : { color: "#64748b" }}>
              <span className="text-base">{item.icon}</span>
              {item.label}
              {item.active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />}
            </div>
          ))}
        </div>
        <div className="p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)" }}>JM</div>
            <div>
              <p className="text-slate-200 text-xs font-medium">James Mwangi</p>
              <p className="text-slate-500 text-xs">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-6 flex-shrink-0" style={{ background: "#0f172a", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-500" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              🔍 <span>Search…</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-400 cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              🏪 Main Branch ▾
            </div>
            <button className="text-sm font-semibold text-white px-4 py-1.5 rounded-lg" style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)" }}>
              + New Sale
            </button>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 cursor-pointer relative" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              🔔
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-violet-400" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6" style={{ background: "#0f172a" }}>
          <div className="mb-6">
            <h1 className="text-white font-bold text-xl">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">Saturday, 25 April 2026 · Main Branch</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl p-4" style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-400 text-xs">{s.label}</p>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${s.up ? "text-emerald-400 bg-emerald-900/30" : "text-red-400 bg-red-900/30"}`}>{s.delta}</span>
                </div>
                <p className="text-white font-bold text-lg">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Middle row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Margin */}
            <div className="rounded-xl p-5" style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-slate-400 text-xs mb-1">Profit Margin</p>
              <p className="text-white font-bold text-3xl mb-4">25%</p>
              <div className="w-full rounded-full h-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full" style={{ width: "25%", background: "linear-gradient(90deg,#8b5cf6,#a78bfa)" }} />
              </div>
              <p className="text-slate-600 text-xs mt-2">Revenue margin vs target 35%</p>
            </div>

            {/* Overdue */}
            <div className="rounded-xl p-5" style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-slate-400 text-xs mb-2">Overdue Balances</p>
              <p className="font-bold text-2xl mb-1" style={{ color: "#f87171" }}>KSh 4,800</p>
              <p className="text-slate-500 text-xs mb-3">3 customers</p>
              <div className="space-y-2">
                {["Eva Njeri", "Tom Karanja", "Mary Wahu"].map((name) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{name}</span>
                    <span className="text-red-400">overdue</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Attendants */}
            <div className="rounded-xl p-5" style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-slate-400 text-xs mb-3">Attendants On Duty</p>
              <div className="space-y-2.5">
                {[
                  { name: "Sarah K.", sales: 12 },
                  { name: "Peter M.", sales: 8 },
                  { name: "Grace W.", sales: 15 },
                ].map((a) => (
                  <div key={a.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold" style={{ background: "rgba(139,92,246,0.4)" }}>{a.name[0]}</div>
                      <span className="text-slate-300 text-xs">{a.name}</span>
                    </div>
                    <span className="text-slate-500 text-xs">{a.sales} sales</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sales table */}
          <div className="rounded-xl overflow-hidden" style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-white font-semibold text-sm">Recent Sales</p>
              <span className="text-xs text-violet-400 cursor-pointer font-medium">View all →</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-600 uppercase tracking-wider">
                  <th className="px-5 py-3 text-left font-medium">Order</th>
                  <th className="px-5 py-3 text-left font-medium">Customer</th>
                  <th className="px-5 py-3 text-left font-medium">Amount</th>
                  <th className="px-5 py-3 text-left font-medium">Method</th>
                  <th className="px-5 py-3 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{s.id}</td>
                    <td className="px-5 py-3 text-slate-200 font-medium">{s.customer}</td>
                    <td className="px-5 py-3">
                      <span className="text-white font-semibold">{s.amount}</span>
                      {s.owes && <p className="text-xs text-orange-400 mt-0.5">Owes {s.owes}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md text-slate-300" style={{ background: methodPill[s.method] || "#1e293b" }}>{s.method}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{s.time}</td>
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
