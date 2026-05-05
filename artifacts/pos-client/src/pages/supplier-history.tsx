import { useState } from 'react';
import { extractId } from '@/lib/utils';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { useQuery } from '@tanstack/react-query';
import { useGoBack } from "@/hooks/useGoBack";
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { useShopDetails, drawShopHeader } from "@/hooks/useShopDetails";
import {
  ArrowLeft, Download, Search, Package, DollarSign, Receipt,
  CreditCard, X, ChevronLeft, ChevronRight, MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { apiRequest } from '@/lib/queryClient';
import { ENDPOINTS } from '@/lib/api-endpoints';
import { useToast } from '@/hooks/use-toast';

interface Purchase {
  _id: string;
  purchaseNo: string;
  supplier: { _id: string; name: string };
  totalAmount: number;
  amountPaid: number;
  outstandingBalance?: number;
  paymentType?: string;
  createdAt: string;
  status: string;
  items: Array<{ product: { name: string }; quantity: number; unitPrice: number }>;
  payments?: Array<{ amount: number; paymentNo: string; date: string; balance: number }>;
  shopId: { currency: string };
}

function fmtAmt(val: number | string | undefined, decimals = 2) {
  return parseFloat(String(val ?? 0)).toFixed(decimals);
}

function getPurchaseStatus(p: any): 'paid' | 'credit' {
  const outstanding = parseFloat(String(p.outstandingBalance ?? 0));
  if (p.paymentType === 'credit' && outstanding > 0.01) return 'credit';
  return 'paid';
}

export default function SupplierHistoryPage() {
  const goBack = useGoBack("/suppliers");
  const { toast } = useToast();

  const searchParams = new URLSearchParams(window.location.search);
  const supplierId   = searchParams.get('supplierId');
  const supplierName = decodeURIComponent(searchParams.get('supplierName') || '');

  const [currentPage, setCurrentPage]   = useState(1);
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isPaymentOpen, setIsPaymentOpen]       = useState(false);

  const ITEMS_PER_PAGE = 10;

  const { selectedShopId, selectedShopData } = useSelector((state: RootState) => state.shop);
  const adminData   = JSON.parse(localStorage.getItem('adminData') || '{}');
  const shopId      = selectedShopId || String(extractId(adminData?.primaryShop) ?? '');
  const shopCurrency = selectedShopData?.currency || adminData?.primaryShop?.currency || 'KES';
  const shopDetails = useShopDetails(shopId);

  // Analytics (summary totals)
  const { data: analyticsData } = useQuery({
    queryKey: [ENDPOINTS.purchases.reportFilter, supplierId, dateFrom, dateTo, shopId, statusFilter],
    queryFn: async () => {
      if (!supplierId || !shopId) return null;
      const p = new URLSearchParams({ shopId, supplierId });
      p.append('fromDate', dateFrom || new Date().toISOString().split('T')[0]);
      p.append('toDate',   dateTo   || new Date().toISOString().split('T')[0]);
      if (statusFilter !== 'all') p.append('paymentType', statusFilter === 'paid' ? 'cash' : 'credit');
      const res = await apiRequest('GET', `${ENDPOINTS.purchases.reportFilter}?${p}`);
      return res.json();
    },
    enabled: !!supplierId && !!shopId,
  });

  // Purchases list
  const { data: purchasesData, isLoading } = useQuery({
    queryKey: [ENDPOINTS.purchases.getAll, 'supplier-history', supplierId, shopId, currentPage, ITEMS_PER_PAGE, searchTerm, statusFilter, dateFrom, dateTo],
    queryFn: async () => {
      if (!supplierId || !shopId) return { data: [], count: 0, totalPages: 0 };
      const attendantId = adminData?.attendantId?._id || adminData?._id;
      const p = new URLSearchParams({ shopId, supplierId, page: currentPage.toString(), limit: ITEMS_PER_PAGE.toString(), paginated: 'true' });
      if (attendantId)          p.append('attendantId', attendantId);
      if (searchTerm)           p.append('purchaseNo', searchTerm);
      if (statusFilter !== 'all') p.append('paymentType', statusFilter === 'paid' ? 'cash' : 'credit');
      if (dateFrom) p.append('start', dateFrom);
      if (dateTo)   p.append('end',   dateTo);
      const res  = await apiRequest('GET', `${ENDPOINTS.purchases.getAll}?${p}`);
      const data = await res.json();
      if (Array.isArray(data)) return { data, count: data.length, totalPages: Math.ceil(data.length / ITEMS_PER_PAGE) };
      return data?.data ? data : { data: [], count: 0, totalPages: 0 };
    },
    enabled: !!supplierId && !!shopId,
    staleTime: 0,
  });

  const purchases  = purchasesData?.data || [];
  const totalPages = purchasesData?.meta?.totalPages ?? purchasesData?.totalPages ?? 1;
  const totalCount = purchasesData?.meta?.total ?? purchasesData?.count ?? purchases.length;

  // Analytics KPIs
  const allPurchaseData  = purchasesData?.data || [];
  const fallbackTotal    = allPurchaseData.reduce((s: number, p: any) => s + (p.totalAmount || 0), 0);
  const fallbackPaid     = allPurchaseData.reduce((s: number, p: any) => s + (p.amountPaid  || 0), 0);
  const totalAmount      = analyticsData?.totalpurchases ?? fallbackTotal;
  const totalPaid        = analyticsData?.paid           ?? fallbackPaid;
  const totalOutstanding = analyticsData?.credit         ?? (fallbackTotal - fallbackPaid);

  const hasFilters = !!(searchTerm || statusFilter !== 'all' || dateFrom || dateTo);
  const clearFilters = () => { setSearchTerm(''); setStatusFilter('all'); setDateFrom(''); setDateTo(''); setCurrentPage(1); };

  // ── Download statement ──────────────────────────────────────────────────────
  const handleDownloadStatement = () => {
    try {
      const statementPurchases = purchasesData?.data || [];

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PW  = doc.internal.pageSize.getWidth();
      const PH  = doc.internal.pageSize.getHeight();
      const ML  = 14;
      const MR  = PW - 14;
      const CW  = MR - ML;
      const purple: [number,number,number]      = [76, 29, 149];
      const purpleLight: [number,number,number] = [237, 233, 254];
      const gray50: [number,number,number]      = [249, 250, 251];
      const gray200: [number,number,number]     = [229, 231, 235];
      const gray500: [number,number,number]     = [107, 114, 128];
      const gray900: [number,number,number]     = [17, 24, 39];
      const red: [number,number,number]         = [220, 38, 38];
      const green: [number,number,number]       = [22, 163, 74];

      const shopName    = shopDetails.name    || 'Supplier Statement';
      const shopAddress = shopDetails.address || '';
      const shopPhone   = shopDetails.phone   || '';
      const shopContact = [shopAddress, shopPhone].filter(Boolean).join('  ·  ');
      const dateStr     = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const periodStr   = `${dateFrom || '—'}  to  ${dateTo || '—'}`;

      // ── Header band ──────────────────────────────────────────────────
      doc.setFillColor(...purple);
      doc.rect(0, 0, PW, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(shopName.toUpperCase(), ML, 10);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 180, 255);
      doc.text('SUPPLIER STATEMENT', MR, 10, { align: 'right' });
      if (shopContact) doc.text(shopContact, ML, 16);
      doc.text(`Date: ${dateStr}`, MR, 16, { align: 'right' });

      // ── Supplier info card ──────────────────────────────────────────
      const cardY = 28;
      const cardH = 22;
      doc.setFillColor(...gray50);
      doc.setDrawColor(...gray200);
      doc.setLineWidth(0.3);
      doc.roundedRect(ML, cardY, CW, cardH, 2, 2, 'FD');
      doc.setTextColor(...gray900);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(supplierName || 'Supplier', ML + 4, cardY + 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...gray500);
      doc.text(`Period: ${periodStr}`, ML + 4, cardY + 15);

      // ── KPI pills ────────────────────────────────────────────────────
      const kpiY = cardY + cardH + 5;
      const kpiH = 18;
      const kpiW = (CW - 9) / 4;

      const drawKpi = (x: number, label: string, value: string, bg: [number,number,number], fg: [number,number,number]) => {
        doc.setFillColor(...bg);
        doc.setDrawColor(...gray200);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, kpiY, kpiW, kpiH, 1.5, 1.5, 'FD');
        doc.setTextColor(...fg);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.text(label.toUpperCase(), x + 3, kpiY + 5.5);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(value, x + 3, kpiY + 13);
      };

      const gap = 3;
      drawKpi(ML,                       'Total Amount', `${shopCurrency} ${fmtAmt(totalAmount)}`,      purpleLight,      purple);
      drawKpi(ML + (kpiW + gap),        'Amount Paid',  `${shopCurrency} ${fmtAmt(totalPaid)}`,        [220,252,231],    green);
      drawKpi(ML + (kpiW + gap) * 2,    'Outstanding',  `${shopCurrency} ${fmtAmt(totalOutstanding)}`, totalOutstanding > 0 ? [254,226,226] : [220,252,231], totalOutstanding > 0 ? red : green);
      drawKpi(ML + (kpiW + gap) * 3,    'Orders',       String(statementPurchases.length),             gray50,           gray500);

      // ── Section title ────────────────────────────────────────────────
      const tableStartY = kpiY + kpiH + 6;
      doc.setTextColor(...purple);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('PURCHASE HISTORY', ML, tableStartY - 1.5);
      doc.setDrawColor(...purple);
      doc.setLineWidth(0.5);
      doc.line(ML, tableStartY + 1, MR, tableStartY + 1);

      // ── Purchases table ──────────────────────────────────────────────
      if (statementPurchases.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(...gray500);
        doc.text('No purchases found for this period.', ML, tableStartY + 12);
      } else {
        autoTable(doc, {
          startY: tableStartY + 4,
          margin: { left: ML, right: 14 },
          head: [['Purchase No', 'Date', 'Items', 'Total', 'Paid', 'Outstanding', 'Status']],
          body: statementPurchases.map((p: any) => {
            const outstanding = parseFloat(String(p.outstandingBalance ?? 0));
            const itemCount   = p.items?.length ?? 0;
            return [
              p.purchaseNo || `P-${p._id?.slice(-6)}`,
              new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
              itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` : '—',
              `${shopCurrency} ${fmtAmt(p.totalAmount)}`,
              `${shopCurrency} ${fmtAmt(p.amountPaid)}`,
              `${shopCurrency} ${fmtAmt(outstanding)}`,
              getPurchaseStatus(p) === 'paid' ? 'Paid' : 'Credit',
            ];
          }),
          headStyles: {
            fillColor: purple, textColor: [255, 255, 255],
            fontSize: 7.5, fontStyle: 'bold',
            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
          },
          bodyStyles: { fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: gray900 },
          alternateRowStyles: { fillColor: [250, 249, 255] },
          columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 22 },
            2: { cellWidth: 18 },
            3: { halign: 'right', cellWidth: 26 },
            4: { halign: 'right', cellWidth: 26 },
            5: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
            6: { cellWidth: 16 },
          },
          didDrawPage: (data) => {
            const pageCount   = (doc as any).internal.getNumberOfPages();
            const currentPage = data.pageNumber;
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...gray500);
            doc.text(`${shopName}  ·  ${supplierName} Statement  ·  ${dateStr}`, ML, PH - 6);
            doc.text(`Page ${currentPage} of ${pageCount}`, MR, PH - 6, { align: 'right' });
            doc.setDrawColor(...gray200);
            doc.setLineWidth(0.3);
            doc.line(ML, PH - 9, MR, PH - 9);
          },
        });
      }

      doc.save(`${(supplierName || 'Supplier').replace(/[^a-zA-Z0-9]/g, '_')}_Statement.pdf`);
      toast({ title: "Statement downloaded" });
    } catch (err: any) {
      toast({ title: "Failed to download", description: err.message, variant: "destructive" });
    }
  };

  // ── Download payment history PDF ────────────────────────────────────────────
  const handleDownloadPaymentHistory = (purchaseId: string) => {
    try {
      const purchase = (purchasesData?.data || []).find((p: any) => p._id === purchaseId);
      if (!purchase) return;

      const doc = new jsPDF();
      let   phY = drawShopHeader(doc, shopDetails, "Payment History Report", `Generated: ${new Date().toLocaleDateString()}`);

      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Purchase No: ${purchase.purchaseNo}   Supplier: ${purchase.supplier?.name || 'N/A'}`, 20, phY); phY += 5;
      doc.text(`Total: ${shopCurrency} ${fmtAmt(purchase.totalAmount)}   Paid: ${shopCurrency} ${fmtAmt(purchase.amountPaid)}`, 20, phY); phY += 6;

      if (purchase.payments?.length) {
        autoTable(doc, {
          head: [['Payment No', 'Date', 'Amount', 'Balance After']],
          body: purchase.payments.map((pay: any) => [
            pay.paymentNo || '',
            new Date(pay.date).toLocaleDateString(),
            `${shopCurrency} ${fmtAmt(pay.amount)}`,
            `${shopCurrency} ${fmtAmt(pay.balance)}`,
          ]),
          startY: phY,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [76, 29, 149] },
          columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
        });
      }

      doc.save(`Purchase_${purchase.purchaseNo}_Payment_History.pdf`);
      toast({ title: "Payment history downloaded" });
    } catch {
      toast({ title: "Failed to download", variant: "destructive" });
    }
  };

  const viewPayments = (purchase: Purchase) => { setSelectedPurchase(purchase); setIsPaymentOpen(true); };

  if (!supplierId) {
    return (
      <DashboardLayout title="Supplier History">
        <div className="py-16 text-center">
          <p className="text-muted-foreground mb-4">No supplier selected</p>
          <Button onClick={goBack}>Back to Suppliers</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`History – ${supplierName}`}>
      <div className="-mx-4 -mt-4 lg:-mx-6 lg:-mt-6">

        {/* ── Sticky header ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
          <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2">
            <button onClick={goBack} className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-gray-100 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{supplierName}</p>
              <p className="text-xs text-muted-foreground hidden sm:block">Purchase History</p>
            </div>
            <Button size="sm" variant="outline" className="h-9 gap-1.5 shrink-0" onClick={handleDownloadStatement}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Statement</span>
            </Button>
          </div>

          {/* Filter row */}
          <div className="px-3 sm:px-4 pb-2.5 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Purchase no…"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-8 h-8 text-xs"
              />
              {searchTerm && (
                <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="h-8 text-xs w-32" />
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="h-8 text-xs w-32" />
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <X className="h-3 w-3" />Clear
              </button>
            )}
          </div>
        </div>

        {/* ── KPI strip ──────────────────────────────────────────────────────── */}
        <div className="px-3 sm:px-4 py-2.5 flex gap-2 sm:gap-4 border-b bg-gray-50/60 overflow-x-auto">
          {[
            { icon: Package,     label: 'Orders',      value: String(totalCount),                              color: 'text-blue-600'   },
            { icon: DollarSign,  label: 'Total',        value: `${shopCurrency} ${fmtAmt(totalAmount)}`,        color: 'text-gray-900'   },
            { icon: CreditCard,  label: 'Paid',         value: `${shopCurrency} ${fmtAmt(totalPaid)}`,          color: 'text-green-600'  },
            { icon: Receipt,     label: 'Outstanding',  value: `${shopCurrency} ${fmtAmt(totalOutstanding)}`,   color: 'text-red-600'    },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-1.5 shrink-0">
              <Icon className={`h-3.5 w-3.5 ${color} shrink-0`} />
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
                <p className={`text-xs font-semibold ${color} leading-tight mt-0.5`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Content ────────────────────────────────────────────────────────── */}
        <div className="px-3 sm:px-4 py-3 pb-24 lg:pb-6">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading purchases…</div>
          ) : purchases.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No purchases found</p>
            </div>
          ) : (
            <>
              {/* ── Mobile cards ─────────────────────────────────────────── */}
              <div className="sm:hidden space-y-2">
                {purchases.map((p: any) => {
                  const outstanding = parseFloat(String(p.outstandingBalance ?? 0));
                  const status      = getPurchaseStatus(p);
                  const itemCount   = p.items?.length ?? 0;
                  return (
                    <div key={p._id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
                      <div className="px-3 pt-3 pb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{p.purchaseNo || `P-${p._id.slice(-6)}`}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {itemCount > 0 && ` · ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
                          </p>
                          {p.items?.slice(0, 2).map((it: any, i: number) => (
                            <p key={i} className="text-xs text-gray-500 truncate max-w-[200px]">
                              {it.product?.name || 'Item'} ×{it.quantity}
                            </p>
                          ))}
                        </div>
                        <div className="shrink-0 text-right space-y-1">
                          <Badge variant={status === 'paid' ? 'default' : 'secondary'}
                            className={`text-[10px] px-1.5 py-0.5 ${status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {status === 'paid' ? 'Paid' : 'Credit'}
                          </Badge>
                        </div>
                      </div>
                      <div className="px-3 pb-2.5 flex items-center justify-between border-t border-gray-50 pt-2 gap-2">
                        <div className="flex gap-4">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Total</p>
                            <p className="text-xs font-semibold">{shopCurrency} {fmtAmt(p.totalAmount)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Paid</p>
                            <p className="text-xs font-semibold text-green-600">{shopCurrency} {fmtAmt(p.amountPaid)}</p>
                          </div>
                          {outstanding > 0 && (
                            <div>
                              <p className="text-[10px] text-muted-foreground">Owed</p>
                              <p className="text-xs font-semibold text-red-600">{shopCurrency} {fmtAmt(outstanding)}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => viewPayments(p)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700">
                            <Receipt className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadPaymentHistory(p._id)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-purple-600">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop table ─────────────────────────────────────────── */}
              <div className="hidden sm:block rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      {['Purchase No', 'Date', 'Items', 'Total', 'Paid', 'Outstanding', 'Status', ''].map(h => (
                        <th key={h} className={`px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${
                          ['Total','Paid','Outstanding'].includes(h) ? 'text-right' : h === '' ? '' : 'text-left'
                        }`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {purchases.map((p: any) => {
                      const outstanding = parseFloat(String(p.outstandingBalance ?? 0));
                      const status      = getPurchaseStatus(p);
                      return (
                        <tr key={p._id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-gray-900">
                            {p.purchaseNo || `P-${p._id.slice(-6)}`}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">
                            {new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-3 py-2.5">
                            {p.items?.length > 0 ? (
                              <div className="space-y-0.5 max-w-[180px]">
                                {p.items.slice(0, 2).map((it: any, i: number) => (
                                  <p key={i} className="text-xs text-gray-600 truncate">{it.product?.name || 'Item'} ×{it.quantity}</p>
                                ))}
                                {p.items.length > 2 && <p className="text-xs text-muted-foreground">+{p.items.length - 2} more</p>}
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium">{shopCurrency} {fmtAmt(p.totalAmount)}</td>
                          <td className="px-3 py-2.5 text-right text-green-700">{shopCurrency} {fmtAmt(p.amountPaid)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={outstanding > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground text-xs'}>
                              {shopCurrency} {fmtAmt(outstanding)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="secondary"
                              className={`text-[10px] px-1.5 py-0.5 ${status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                              {status === 'paid' ? 'Paid' : 'Credit'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-sm">
                                <DropdownMenuItem onClick={() => viewPayments(p)}>
                                  <Receipt className="h-3.5 w-3.5 mr-2" />Payment History
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadPaymentHistory(p._id)}>
                                  <Download className="h-3.5 w-3.5 mr-2" />Download Receipt
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Table footer */}
                <div className="px-4 py-2 bg-muted/20 border-t flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{totalCount} purchase{totalCount !== 1 ? 's' : ''}{totalPages > 1 && ` · page ${currentPage} of ${totalPages}`}</span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs"
                        disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                        ← Prev
                      </Button>
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        const pg = totalPages <= 7 ? i + 1
                          : currentPage <= 4 ? i + 1
                          : currentPage >= totalPages - 3 ? totalPages - 6 + i
                          : currentPage - 3 + i;
                        return (
                          <Button key={pg} variant={pg === currentPage ? 'default' : 'outline'} size="sm"
                            className={`h-7 w-7 p-0 text-xs ${pg === currentPage ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                            onClick={() => setCurrentPage(pg)}>
                            {pg}
                          </Button>
                        );
                      })}
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs"
                        disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                        Next →
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile pagination */}
              {totalPages > 1 && (
                <div className="sm:hidden flex items-center justify-between mt-3 px-1">
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs"
                    disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />Prev
                  </Button>
                  <span className="text-xs text-muted-foreground">{currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs"
                    disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    Next<ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Payment History Dialog ──────────────────────────────────────────── */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4" />
                Payments — {selectedPurchase?.purchaseNo || `P-${selectedPurchase?._id.slice(-6)}`}
              </DialogTitle>
            </DialogHeader>
            {selectedPurchase && (
              <div className="space-y-3">
                {/* Mini summary */}
                <div className="grid grid-cols-3 gap-2 text-center rounded-lg bg-muted/40 px-3 py-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                    <p className="text-sm font-semibold">{shopCurrency} {fmtAmt(selectedPurchase.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Paid</p>
                    <p className="text-sm font-semibold text-green-600">{shopCurrency} {fmtAmt(selectedPurchase.amountPaid)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Owed</p>
                    <p className="text-sm font-semibold text-red-600">
                      {shopCurrency} {fmtAmt((selectedPurchase.totalAmount || 0) - (selectedPurchase.amountPaid || 0))}
                    </p>
                  </div>
                </div>

                {selectedPurchase.payments?.length ? (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b">
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Payment No</th>
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Date</th>
                          <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Amount</th>
                          <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Balance After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedPurchase.payments.map((pay, i) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="px-3 py-2 font-medium">{pay.paymentNo || `—`}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {new Date(pay.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-3 py-2 text-right text-green-700 font-medium">{shopCurrency} {fmtAmt(pay.amount)}</td>
                            <td className="px-3 py-2 text-right">{shopCurrency} {fmtAmt(pay.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No payments recorded</p>
                  </div>
                )}

                <div className="flex justify-between pt-1">
                  <Button variant="outline" size="sm" onClick={() => handleDownloadPaymentHistory(selectedPurchase._id)}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />Download
                  </Button>
                  <Button size="sm" onClick={() => setIsPaymentOpen(false)}>Close</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
