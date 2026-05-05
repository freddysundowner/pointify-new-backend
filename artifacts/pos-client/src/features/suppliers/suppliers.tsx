import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Plus, Search, Edit, Trash2, Phone, Mail, MapPin, Building2,
  History, ArrowLeft, CreditCard, Download, FileText, MoreVertical, X,
} from 'lucide-react';
import { useGoBack } from "@/hooks/useGoBack";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { ENDPOINTS } from '@/lib/api-endpoints';
import DashboardLayout from '@/components/layout/dashboard-layout';
import AlertModal from '@/components/ui/alert-modal';
import { useForm } from 'react-hook-form';
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useAuth } from "@/features/auth/useAuth";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

interface Supplier {
  id: number;
  _id?: string;
  name: string;
  phone?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  wallet?: string | number;
  outstandingBalance?: string | number;
}

interface SupplierFormData {
  name: string;
  phoneNumber: string;
  email: string;
  address: string;
}

function fmt(val: string | number | undefined | null, decimals = 2) {
  return parseFloat(String(val ?? 0)).toFixed(decimals);
}

function supplierId(s: Supplier): string {
  return String(s._id ?? s.id);
}

const PAGE_SIZE = 20;

export default function SuppliersPage() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm]     = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [page, setPage]                 = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen]     = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPayOpen, setIsPayOpen]       = useState(false);
  const [selected, setSelected]         = useState<Supplier | null>(null);
  const [payAmount, setPayAmount]       = useState(0);
  const [statLoading, setStatLoading]   = useState(false);
  const { toast } = useToast();

  // Debounce search → reset to page 1 on new term
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(searchTerm); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { admin } = useAuth();
  const { attendant } = useAttendantAuth();
  const isAttendantRoute = window.location.pathname.startsWith('/attendant');
  const handleBack = useGoBack("/dashboard");

  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const primaryShop = typeof admin?.primaryShop === 'object' ? admin.primaryShop : null;
  const attendantShopId = typeof attendant?.shopId === 'object' ? attendant.shopId._id : attendant?.shopId;
  const shopId = isAttendantRoute ? attendantShopId : (selectedShopId || (primaryShop as any)?._id);

  const createForm = useForm<SupplierFormData>({ defaultValues: { name: '', phoneNumber: '', email: '', address: '' } });
  const editForm   = useForm<SupplierFormData>({ defaultValues: { name: '', phoneNumber: '', email: '', address: '' } });

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const { data: queryResult, isLoading, isFetching } = useQuery({
    queryKey: [ENDPOINTS.suppliers.getAll, shopId, page, debouncedSearch],
    queryFn: async () => {
      if (!shopId) return { rows: [], total: 0, totalPages: 0 };
      const params = new URLSearchParams({ shopId: String(shopId), page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res  = await apiRequest('GET', `${ENDPOINTS.suppliers.getAll}?${params}`);
      const json = await res.json();
      const rows = (Array.isArray(json) ? json : (json.data ?? [])).map(
        (s: any) => ({ ...s, phoneNumber: s.phoneNumber ?? s.phone ?? '' })
      );
      const meta = json.meta ?? {};
      return { rows, total: meta.total ?? rows.length, totalPages: meta.totalPages ?? 1 };
    },
    enabled: !!shopId,
    placeholderData: (prev) => prev,
  });

  const suppliers: Supplier[] = queryResult?.rows ?? [];
  const totalPages = queryResult?.totalPages ?? 1;
  const total      = queryResult?.total ?? 0;

  // ── Mutations ────────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [ENDPOINTS.suppliers.getAll] });

  const createMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const res = await apiRequest('POST', ENDPOINTS.suppliers.create, {
        name: data.name, phone: data.phoneNumber, email: data.email, address: data.address, shopId,
      });
      return res.json();
    },
    onSuccess: () => { toast({ title: "Supplier created" }); invalidate(); setIsCreateOpen(false); createForm.reset(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      if (!selected) throw new Error('No supplier selected');
      const res = await apiRequest('PUT', ENDPOINTS.suppliers.update(supplierId(selected)), {
        name: data.name, phone: data.phoneNumber, email: data.email, address: data.address,
      });
      return res.json();
    },
    onSuccess: () => { toast({ title: "Supplier updated" }); invalidate(); setIsEditOpen(false); setSelected(null); editForm.reset(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', ENDPOINTS.suppliers.delete(id)),
    onSuccess: () => { toast({ title: "Supplier deleted" }); invalidate(); setIsDeleteOpen(false); setSelected(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const payMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const res = await apiRequest('POST', ENDPOINTS.suppliers.walletPayment(id), { amount });
      return res.json();
    },
    onSuccess: () => { toast({ title: "Payment recorded" }); invalidate(); setIsPayOpen(false); setSelected(null); setPayAmount(0); },
    onError: (e: any) => toast({ title: "Payment failed", description: e.message, variant: "destructive" }),
  });

  // ── Statement PDF ─────────────────────────────────────────────────────────────
  const downloadStatement = async (supplier: Supplier) => {
    setStatLoading(true);
    try {
      const sid = supplierId(supplier);
      const res  = await apiRequest('GET', `${ENDPOINTS.suppliers.walletTransactions(sid)}?limit=200`);
      const json = await res.json();
      const txns: any[] = Array.isArray(json) ? json : (json.data ?? []);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw  = doc.internal.pageSize.getWidth();
      const W   = pw - 28;

      // Header bar
      doc.setFillColor(88, 28, 135);
      doc.rect(0, 0, pw, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Supplier Statement', 14, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 20);

      // Supplier info box
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(250, 248, 255);
      doc.roundedRect(14, 34, W, 34, 2, 2, 'FD');
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(supplier.name, 20, 44);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const infoY = 51;
      const infoParts: string[] = [];
      if (supplier.phoneNumber) infoParts.push(`Phone: ${supplier.phoneNumber}`);
      if (supplier.email)       infoParts.push(`Email: ${supplier.email}`);
      if (supplier.address)     infoParts.push(`Address: ${supplier.address}`);
      doc.text(infoParts.join('   |   '), 20, infoY);

      // KPI boxes
      const kpiY = 74;
      const kpiW = (W - 6) / 2;
      const wallet = parseFloat(fmt(supplier.wallet));
      const outstanding = parseFloat(fmt(supplier.outstandingBalance));

      const drawKpi = (x: number, label: string, value: string, color: [number,number,number]) => {
        doc.setFillColor(...color);
        doc.roundedRect(x, kpiY, kpiW, 20, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text(label.toUpperCase(), x + 4, kpiY + 7);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(value, x + 4, kpiY + 15);
      };
      drawKpi(14, 'Wallet Balance', `KES ${fmt(wallet)}`, [88, 28, 135]);
      drawKpi(14 + kpiW + 6, 'Outstanding Balance', `KES ${fmt(outstanding)}`, outstanding > 0 ? [220, 38, 38] : [22, 163, 74]);

      // Transactions table
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Transaction History', 14, kpiY + 30);

      if (txns.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text('No transactions found.', 14, kpiY + 40);
      } else {
        autoTable(doc, {
          startY: kpiY + 34,
          margin: { left: 14, right: 14 },
          head: [['Date', 'Type', 'Ref / Payment No', 'Payment Method', 'Amount', 'Balance']],
          body: txns.map((t: any) => [
            new Date(t.createdAt).toLocaleDateString('en-GB'),
            (t.type || '').charAt(0).toUpperCase() + (t.type || '').slice(1),
            [t.paymentReference, t.paymentNo].filter(Boolean).join(' / ') || '—',
            t.paymentType || '—',
            `KES ${parseFloat(String(t.amount || 0)).toFixed(2)}`,
            `KES ${parseFloat(String(t.balance || 0)).toFixed(2)}`,
          ]),
          headStyles: { fillColor: [88, 28, 135], textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
          bodyStyles: { fontSize: 8, cellPadding: 2.5 },
          alternateRowStyles: { fillColor: [250, 248, 255] },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 22 },
            4: { halign: 'right', cellWidth: 28 },
            5: { halign: 'right', cellWidth: 28 },
          },
        });
      }

      doc.save(`${supplier.name.replace(/\s+/g, '_')}_statement.pdf`);
      toast({ title: "Statement downloaded" });
    } catch (e: any) {
      toast({ title: "Failed to download statement", description: e.message, variant: "destructive" });
    } finally {
      setStatLoading(false);
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openEdit = (s: Supplier) => {
    setSelected(s);
    editForm.reset({ name: s.name, phoneNumber: s.phoneNumber ?? '', email: s.email ?? '', address: s.address ?? '' });
    setIsEditOpen(true);
  };

  const openDelete = (s: Supplier) => { setSelected(s); setIsDeleteOpen(true); };

  const openPay = (s: Supplier) => {
    setSelected(s);
    setPayAmount(parseFloat(fmt(s.outstandingBalance)));
    setIsPayOpen(true);
  };

  const viewHistory = (s: Supplier) => {
    const route = isAttendantRoute ? '/attendant/supplier-history' : '/supplier-history';
    navigate(`${route}?supplierId=${supplierId(s)}&supplierName=${encodeURIComponent(s.name)}`);
  };

  // Backend handles search + pagination — `suppliers` is already the current page slice

  // ── Supplier Form (reused for create & edit) ──────────────────────────────────
  const SupplierForm = ({
    form, onSubmit, isPending, label, onCancel,
  }: { form: any; onSubmit: (d: SupplierFormData) => void; isPending: boolean; label: string; onCancel: () => void }) => (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 pt-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Label className="text-xs font-medium">Supplier Name *</Label>
          <Input {...form.register('name', { required: true })} placeholder="e.g. ABC Wholesale Ltd" className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs font-medium">Phone Number</Label>
          <Input {...form.register('phoneNumber')} placeholder="+254 700 000000" className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs font-medium">Email</Label>
          <Input type="email" {...form.register('email')} placeholder="supplier@email.com" className="mt-1 h-9 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs font-medium">Address</Label>
          <Textarea {...form.register('address')} placeholder="Street, City" rows={2} className="mt-1 text-sm resize-none" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? `${label}ing…` : label}</Button>
      </div>
    </form>
  );

  return (
    <DashboardLayout title="Suppliers">
      {/* Break out of DashboardLayout's padding so the sticky header sits flush */}
      <div className="-mx-4 -mt-4 lg:-mx-6 lg:-mt-6">

      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2">
          <button onClick={handleBack} className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-gray-100 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search suppliers…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button size="sm" className="h-9 gap-1.5 shrink-0" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add Supplier</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className={`px-3 sm:px-4 py-3 pb-24 lg:pb-6 transition-opacity duration-150 ${isFetching && !isLoading ? 'opacity-60' : 'opacity-100'}`}>
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading suppliers…</div>
        ) : suppliers.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              {debouncedSearch ? 'No suppliers match your search' : 'No suppliers yet'}
            </p>
            {!debouncedSearch && (
              <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add First Supplier
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* ── Mobile card list ─────────────────────────────────────── */}
            <div className="sm:hidden space-y-2">
              {suppliers.map(s => {
                const owed      = parseFloat(fmt(s.outstandingBalance));
                const walletBal = parseFloat(fmt(s.wallet));
                return (
                  <div key={supplierId(s)} className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                          {s.phoneNumber && (
                            <span className="text-xs text-gray-400 flex items-center gap-0.5">
                              <Phone className="h-2.5 w-2.5" />{s.phoneNumber}
                            </span>
                          )}
                          {s.email && (
                            <span className="text-xs text-gray-400 flex items-center gap-0.5">
                              <Mail className="h-2.5 w-2.5" />{s.email}
                            </span>
                          )}
                          {s.address && (
                            <span className="text-xs text-gray-400 flex items-center gap-0.5 truncate max-w-[160px]">
                              <MapPin className="h-2.5 w-2.5 shrink-0" />{s.address}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {owed > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">Owed {fmt(owed)}</Badge>
                        )}
                        {walletBal > 0 && (
                          <Badge className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 ml-1">Wallet {fmt(walletBal)}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 px-3 pb-2.5 border-t border-gray-50 pt-2">
                      {owed > 0 && (
                        <Button variant="default" size="sm" onClick={() => openPay(s)}
                          className="h-7 text-xs bg-green-600 hover:bg-green-700 gap-1 mr-1">
                          <CreditCard className="h-3 w-3" />Pay
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => viewHistory(s)} className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700">
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => downloadStatement(s)} disabled={statLoading}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-purple-600">
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)} className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openDelete(s)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop table ────────────────────────────────────────── */}
            <div className="hidden sm:block rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Supplier</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wallet</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outstanding</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {suppliers.map(s => {
                    const owed      = parseFloat(fmt(s.outstandingBalance));
                    const walletBal = parseFloat(fmt(s.wallet));
                    return (
                      <tr key={supplierId(s)} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{s.name}</p>
                          {s.address && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]"><MapPin className="inline h-2.5 w-2.5 mr-0.5" />{s.address}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {s.phoneNumber && <p className="text-xs text-gray-600 flex items-center gap-1"><Phone className="h-3 w-3" />{s.phoneNumber}</p>}
                            {s.email       && <p className="text-xs text-gray-600 flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {walletBal > 0
                            ? <span className="text-purple-700 font-medium">{fmt(walletBal)}</span>
                            : <span className="text-muted-foreground text-xs">0.00</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {owed > 0
                            ? <span className="text-red-600 font-medium">{fmt(owed)}</span>
                            : <span className="text-muted-foreground text-xs">0.00</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {owed > 0 && (
                              <Button size="sm" onClick={() => openPay(s)}
                                className="h-7 text-xs bg-green-600 hover:bg-green-700 px-2 gap-1">
                                <CreditCard className="h-3 w-3" />Pay
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-sm">
                                <DropdownMenuItem onClick={() => viewHistory(s)}>
                                  <History className="h-3.5 w-3.5 mr-2" />Purchase History
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => downloadStatement(s)} disabled={statLoading}>
                                  <Download className="h-3.5 w-3.5 mr-2" />Download Statement
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEdit(s)}>
                                  <Edit className="h-3.5 w-3.5 mr-2" />Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDelete(s)} className="text-red-600 focus:text-red-600">
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Desktop table footer with pagination */}
              <div className="px-4 py-2 bg-muted/20 border-t flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {total} supplier{total !== 1 ? 's' : ''}
                  {totalPages > 1 && ` · page ${page} of ${totalPages}`}
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs"
                      disabled={page <= 1 || isFetching} onClick={() => setPage(p => p - 1)}>
                      ← Prev
                    </Button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const p = totalPages <= 7 ? i + 1
                        : page <= 4 ? i + 1
                        : page >= totalPages - 3 ? totalPages - 6 + i
                        : page - 3 + i;
                      return (
                        <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm"
                          className={`h-7 w-7 p-0 text-xs ${p === page ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                          disabled={isFetching} onClick={() => setPage(p)}>
                          {p}
                        </Button>
                      );
                    })}
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs"
                      disabled={page >= totalPages || isFetching} onClick={() => setPage(p => p + 1)}>
                      Next →
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile pagination bar */}
            {totalPages > 1 && (
              <div className="sm:hidden flex items-center justify-between mt-3 px-1">
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs"
                  disabled={page <= 1 || isFetching} onClick={() => setPage(p => p - 1)}>
                  ← Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs"
                  disabled={page >= totalPages || isFetching} onClick={() => setPage(p => p + 1)}>
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Supplier</DialogTitle></DialogHeader>
          <SupplierForm
            form={createForm}
            onSubmit={d => createMutation.mutate(d)}
            isPending={createMutation.isPending}
            label="Create"
            onCancel={() => setIsCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Supplier</DialogTitle></DialogHeader>
          <SupplierForm
            form={editForm}
            onSubmit={d => updateMutation.mutate(d)}
            isPending={updateMutation.isPending}
            label="Update"
            onCancel={() => setIsEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Pay Outstanding Dialog ──────────────────────────────────────────── */}
      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Pay Outstanding Balance</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Supplier: </span><span className="font-medium">{selected?.name}</span></p>
              <p><span className="text-muted-foreground">Outstanding: </span>
                <span className="font-semibold text-red-600">{fmt(selected?.outstandingBalance)}</span></p>
            </div>
            <div>
              <Label className="text-xs font-medium">Payment Amount</Label>
              <Input
                type="number" min="0.01" step="0.01"
                value={payAmount}
                onChange={e => setPayAmount(Number(e.target.value))}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsPayOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={payMutation.isPending || payAmount <= 0}
                className="bg-green-600 hover:bg-green-700"
                onClick={() => selected && payMutation.mutate({ id: supplierId(selected), amount: payAmount })}>
                {payMutation.isPending ? 'Processing…' : 'Record Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ──────────────────────────────────────────────────── */}
      <AlertModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => selected && deleteMutation.mutate(supplierId(selected))}
        title="Delete Supplier"
        description={`Are you sure you want to delete "${selected?.name}"? This cannot be undone.`}
        type="danger"
        confirmText={deleteMutation.isPending ? "Deleting…" : "Delete"}
      />

      </div>{/* end -mx-4 -mt-4 wrapper */}
    </DashboardLayout>
  );
}
