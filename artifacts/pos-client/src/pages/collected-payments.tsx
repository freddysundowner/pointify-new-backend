import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { ArrowLeft, DollarSign, ChevronLeft, ChevronRight, RefreshCw, User, CheckCircle2, Clock, Download } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useGoBack } from "@/hooks/useGoBack";
import { apiRequest } from "@/lib/queryClient";

function fmt(val: any, currency = "KES") {
  const n = Number(val ?? 0);
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(val: any) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(val: any) {
  if (!val) return "";
  return new Date(val).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function methodColor(m: string) {
  const l = (m ?? "").toLowerCase();
  if (l.includes("cash")) return "bg-green-100 text-green-700";
  if (l.includes("mpesa") || l.includes("m-pesa")) return "bg-emerald-100 text-emerald-700";
  if (l.includes("bank")) return "bg-blue-100 text-blue-700";
  if (l.includes("wallet")) return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-600";
}

function buildReceiptHtml(row: any, currency: string, shopName: string) {
  const cleared = Number(row.balance ?? 0) <= 0;
  const amount = fmt(row.amount, currency);
  const saleTotal = fmt(row.total_with_discount, currency);
  const balance = cleared ? "Cleared" : fmt(row.balance, currency);
  const receiptNo = row.receipt_no || `#${row.sale_id}`;
  const dateStr = `${fmtDate(row.paid_at)} · ${fmtTime(row.paid_at)}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Payment Receipt – ${receiptNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a1a; }
    .page { width: 80mm; margin: 0 auto; padding: 6mm; }
    .header { text-align: center; padding-bottom: 5mm; border-bottom: 1px dashed #ccc; }
    .shop { font-size: 13pt; font-weight: 700; margin-bottom: 1mm; }
    .label { font-size: 7pt; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
    .amount-big { font-size: 22pt; font-weight: 800; margin: 2mm 0 1mm; }
    .sub { font-size: 7.5pt; color: #555; }
    .section { padding: 4mm 0; border-bottom: 1px dashed #e0e0e0; }
    .row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5mm; }
    .row-label { font-size: 8pt; color: #666; }
    .row-val { font-size: 8.5pt; font-weight: 600; }
    .row-val.mono { font-family: 'Courier New', monospace; }
    .row-val.teal { color: #0d9488; }
    .row-val.green { color: #16a34a; }
    .row-val.orange { color: #ea580c; }
    .box { background: #f5f5f5; border-radius: 3mm; padding: 3mm; margin-top: 3mm; }
    .box-title { font-size: 7pt; color: #999; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2mm; }
    .divider { border: none; border-top: 1px solid #e0e0e0; margin: 1.5mm 0; }
    .footer { text-align: center; font-size: 7pt; color: #aaa; padding-top: 4mm; }
    @media print {
      @page { size: 80mm auto; margin: 0; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="shop">${shopName}</div>
    <div class="label" style="margin-top:2mm;">Payment Receipt</div>
    <div class="amount-big">${amount}</div>
    <div class="sub">${dateStr}</div>
  </div>

  ${row.customer_name ? `
  <div class="section">
    <div class="box-title">Customer</div>
    <div class="row">
      <span class="row-label">Name</span>
      <span class="row-val">${row.customer_name}</span>
    </div>
    ${row.customer_phone ? `<div class="row"><span class="row-label">Phone</span><span class="row-val">${row.customer_phone}</span></div>` : ""}
  </div>` : ""}

  <div class="section">
    <div class="row">
      <span class="row-label">Payment Method</span>
      <span class="row-val" style="text-transform:capitalize;">${row.payment_type ?? "—"}</span>
    </div>
    ${row.payment_reference ? `<div class="row"><span class="row-label">Reference</span><span class="row-val mono">${row.payment_reference}</span></div>` : ""}
  </div>

  <div class="box">
    <div class="box-title">Original Sale</div>
    <div class="row">
      <span class="row-label">Receipt No</span>
      <span class="row-val mono">${receiptNo}</span>
    </div>
    <div class="row">
      <span class="row-label">Sale Total</span>
      <span class="row-val">${saleTotal}</span>
    </div>
    <div class="row">
      <span class="row-label">This Payment</span>
      <span class="row-val teal">${amount}</span>
    </div>
    <hr class="divider"/>
    <div class="row">
      <span class="row-label">Remaining Balance</span>
      <span class="row-val ${cleared ? "green" : "orange"}">${balance}</span>
    </div>
  </div>

  <div class="footer">Thank you for your payment</div>
</div>
<script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };</script>
</body>
</html>`;
}

function PaymentReceiptModal({ row, currency, shopName, onClose }: {
  row: any;
  currency: string;
  shopName: string;
  onClose: () => void;
}) {
  const cleared = Number(row.balance ?? 0) <= 0;

  function handlePrint() {
    const html = buildReceiptHtml(row, currency, shopName);
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Receipt header */}
        <div className="bg-teal-600 px-6 pt-6 pb-5 text-white text-center">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="text-xs font-medium text-teal-200 uppercase tracking-widest mb-1">Payment Receipt</p>
          <p className="text-3xl font-bold">{fmt(row.amount, currency)}</p>
          <p className="text-xs text-teal-200 mt-1">Debt collected</p>
        </div>

        {/* Receipt body */}
        <div className="bg-white px-6 py-5 space-y-4">

          {/* Shop & date */}
          <div className="text-center border-b pb-4">
            <p className="text-sm font-semibold text-gray-800">{shopName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(row.paid_at)} · {fmtTime(row.paid_at)}</p>
          </div>

          {/* Customer */}
          {row.customer_name && (
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Customer</p>
                <p className="text-sm font-medium text-gray-800">{row.customer_name}</p>
                {row.customer_phone && <p className="text-xs text-gray-500">{row.customer_phone}</p>}
              </div>
            </div>
          )}

          {/* Payment method */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-xs text-gray-400">Payment method</span>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${methodColor(row.payment_type)}`}>
              {row.payment_type ?? "—"}
            </span>
          </div>

          {/* Reference */}
          {row.payment_reference && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-xs text-gray-400">Reference</span>
              <span className="text-xs font-mono text-gray-700">{row.payment_reference}</span>
            </div>
          )}

          {/* Original sale */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Original Sale</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Receipt No</span>
              <span className="font-mono font-medium text-gray-800">{row.receipt_no || `#${row.sale_id}`}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sale Total</span>
              <span className="font-medium text-gray-800">{fmt(row.total_with_discount, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">This Payment</span>
              <span className="font-bold text-teal-700">{fmt(row.amount, currency)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-sm items-center">
              <span className="text-gray-500">Remaining Balance</span>
              {cleared ? (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Cleared</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-orange-500">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">{fmt(row.balance, currency)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <Button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white gap-1.5" onClick={handlePrint}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CollectedPaymentsPage() {
  const goBack = useGoBack("/reports/sales");
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { shop } = usePrimaryShop();
  const shopId = selectedShopId || shop?.id;
  const currency = shop?.currency || "KES";
  const shopName = shop?.name || "Shop";

  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const [startDate, setStartDate] = useState(params.get("startDate") || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(params.get("endDate") || new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const limit = 20;

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["collected-payments", shopId, startDate, endDate, page],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (shopId) p.set("shopId", String(shopId));
      if (startDate) p.set("start", startDate);
      if (endDate) p.set("end", endDate);
      p.set("page", String(page));
      p.set("limit", String(limit));
      const res = await apiRequest("GET", `${ENDPOINTS.sales.collectedPayments}?${p}`);
      return res.json();
    },
    enabled: !!shopId,
    staleTime: 0,
  });

  const rows: any[] = data?.data ?? [];
  const totalCount: number = data?.total ?? 0;
  const totalPages = Math.ceil(totalCount / limit);
  const totalCollected = rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  const dateLabel = startDate === endDate
    ? fmtDate(startDate + "T12:00:00")
    : `${fmtDate(startDate + "T12:00:00")} – ${fmtDate(endDate + "T12:00:00")}`;

  return (
    <DashboardLayout>
      <div className="w-full space-y-4 pb-10">

        {/* Header */}
        <div className="flex items-center gap-3 pt-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Collected Debt</h1>
            <p className="text-xs text-gray-400">{dateLabel}</p>
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </div>

        {/* Date filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-400">From</label>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setPage(1); }}
                className="text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-400">To</label>
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setPage(1); }}
                className="text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary card */}
        <Card className="border-0 shadow-sm bg-teal-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-teal-500 font-medium">Total Collected (this page)</p>
              <p className="text-2xl font-bold text-teal-700 leading-tight">{fmt(totalCollected, currency)}</p>
              <p className="text-xs text-teal-400">{totalCount} transaction{totalCount !== 1 ? "s" : ""} in period</p>
            </div>
          </CardContent>
        </Card>

        {/* Transactions table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <DollarSign className="h-10 w-10 text-gray-200 mb-3" />
                <p className="text-gray-500 font-medium">No collections found</p>
                <p className="text-xs text-gray-400 mt-1">No debt payments were collected in this period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b bg-gray-50">
                      <th className="text-left px-4 py-2.5 font-medium">Date & Time</th>
                      <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Sale</th>
                      <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                      <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Method</th>
                      <th className="text-right px-4 py-2.5 font-medium">Collected</th>
                      <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((row: any) => (
                      <tr
                        key={row.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedRow(row)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{fmtDate(row.paid_at)}</p>
                          <p className="text-xs text-gray-400">{fmtTime(row.paid_at)}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <p className="text-gray-700 font-mono text-xs">{row.receipt_no || `#${row.sale_id}`}</p>
                          <p className="text-xs text-gray-400">{fmt(row.total_with_discount, currency)}</p>
                        </td>
                        <td className="px-4 py-3">
                          {row.customer_name ? (
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-gray-300 shrink-0" />
                              <div>
                                <p className="text-gray-700 font-medium leading-tight">{row.customer_name}</p>
                                {row.customer_phone && <p className="text-xs text-gray-400">{row.customer_phone}</p>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Walk-in</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${methodColor(row.payment_type)}`}>
                            {row.payment_type ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-bold text-teal-700">{fmt(row.amount, currency)}</p>
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          {Number(row.balance) > 0
                            ? <p className="text-orange-500 font-medium text-xs">{fmt(row.balance, currency)}</p>
                            : <span className="text-xs text-green-600 font-medium">Cleared</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-gray-400">Page {page} of {totalPages} · {totalCount} records</p>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Payment receipt modal */}
      {selectedRow && (
        <PaymentReceiptModal
          row={selectedRow}
          currency={currency}
          shopName={shopName}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </DashboardLayout>
  );
}
