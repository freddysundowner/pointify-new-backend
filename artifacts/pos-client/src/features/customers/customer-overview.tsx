import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { normalizeIds } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, User, CreditCard, ShoppingBag, Calendar, DollarSign, TrendingUp, FileText, Phone, Mail, MapPin, ArrowLeft, Filter, ChevronLeft, ChevronRight, Wallet, Plus, Download, Star, Minus } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { useAuth } from '@/features/auth/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { ENDPOINTS } from '@/lib/api-endpoints';
import { useNavigationRoute } from '@/lib/navigation-utils';

interface CustomerTransaction {
  _id: string;
  date: string;
  type: 'purchase' | 'payment' | 'refund' | 'credit';
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'cancelled';
  referenceNumber: string;
}

interface Sale {
  _id: string;
  receiptno: string;
  customerId?: string;
  customerName?: string;
  items: Array<{
    productName?: string;
    product?: { name: string };
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  paymentTag: string;
  status: string;
  saleDate: string;
  createdAt: string;
  attendantId?: {
    username: string;
  };
  shopId?: {
    currency: string;
    name: string;
  };
}

interface CustomerPurchase {
  _id: string;
  date: string;
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  totalAmount: number;
  paymentMethod: string;
  status: 'completed' | 'pending' | 'cancelled';
  receiptNumber: string;
}

interface CustomerOverviewData {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  balance: number;
  totalPurchases: number;
  totalSpent: number;
  joinDate: string;
  lastPurchase?: string;
  status: 'active' | 'inactive';
  customerType: 'regular' | 'vip' | 'wholesale';
  creditLimit: number;
  loyaltyPoints: number;
}



export default function CustomerOverview() {
  const [activeTab, setActiveTab] = useState("sales");
  const [salesFilter, setSalesFilter] = useState("all");
  const customersRoute = useNavigationRoute('customers');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [isDebtPaymentDialogOpen, setIsDebtPaymentDialogOpen] = useState(false);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [statementFilter, setStatementFilter] = useState("all");
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const { toast } = useToast();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { admin } = useAuth();
  
  // Get customer ID from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const customerId = urlParams.get('id');

  const effectiveShopId = selectedShopId || '';

  // Fetch the real customer record directly from the API
  const { data: customerData, isLoading: customerLoading } = useQuery({
    queryKey: ['customer-detail', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const token = localStorage.getItem('authToken') || localStorage.getItem('attendantToken');
      const response = await fetch(ENDPOINTS.customers.getById(customerId), {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) return null;
      const result = await response.json();
      const raw = result?.data ?? result;
      return raw ? { ...raw, _id: String(raw.id ?? raw._id) } : null;
    },
    enabled: !!customerId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: [ENDPOINTS.sales.getAll, customerId, effectiveShopId, salesFilter],
    enabled: !!customerId, // Only need customer ID
    queryFn: async () => {
      if (!customerId) return { data: [] };
      
      const params = new URLSearchParams();
      if (effectiveShopId) params.append('shopId', effectiveShopId);
      params.append('customerId', customerId);
      params.append('paginated', 'true');
      params.append('page', '1');
      params.append('limit', '100');
      if (salesFilter === 'credit') params.append('paymentTag', 'credit');
      else if (salesFilter === 'cash') params.append('paymentTag', 'cash');

      const url = `${ENDPOINTS.sales.getAll}?${params.toString()}`;
      const token = localStorage.getItem('authToken') || localStorage.getItem('attendantToken');
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) return { data: [], count: 0, totalPages: 0, currentPage: 1 };
      
      const raw = await response.json();
      const normalized = raw?.data ? { ...raw, data: normalizeIds(raw.data) } : raw;
      return normalized;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: false, // Don't retry to see immediate errors
  });

  // Fetch customer payment history
  const { data: customerPayments = [], isLoading: isLoadingPayments } = useQuery({
    queryKey: [ENDPOINTS.customers.getPayments(customerId ?? ''), statementFilter],
    queryFn: async () => {
      if (!customerId) return [];
      
      const token = localStorage.getItem('authToken') || localStorage.getItem('attendantToken');
      const url = `${ENDPOINTS.customers.getPayments(customerId)}?type=${statementFilter}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) return [];
      
      const result = await response.json();
      const list = Array.isArray(result) ? result : result?.data || result?.payments || [];
      return normalizeIds(list);
    },
    enabled: !!customerId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Fetch shop details for PDF header (use customer's shop field as fallback)
  const shopIdForQuery = effectiveShopId || String(customerData?.shop || '');
  const { data: shopData } = useQuery({
    queryKey: ['shop-detail', shopIdForQuery],
    queryFn: async () => {
      if (!shopIdForQuery) return null;
      const token = localStorage.getItem('authToken') || localStorage.getItem('attendantToken');
      const res = await fetch(ENDPOINTS.shops.getById(shopIdForQuery), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const result = await res.json();
      return result?.data ?? result;
    },
    enabled: !!shopIdForQuery,
    staleTime: 60000,
  });

  // Debt payment mutation
  const debtPaymentMutation = useMutation({
    mutationFn: async (paymentData: { amount: number; paymentMethod: string; notes: string }) => {
      if (!customerId) throw new Error('Customer data not available');
      const response = await apiRequest('POST', ENDPOINTS.customers.walletPayment(customerId), {
        amount: paymentData.amount,
        paymentType: paymentData.paymentMethod,
        paymentReference: paymentData.notes || undefined,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || 'Failed to record payment');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.sales.getAll, customerId, effectiveShopId, salesFilter] });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.customers.getPayments(customerId ?? ''), statementFilter] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-analysis'] });
      toast({
        title: "Payment Recorded",
        description: `Debt payment of ${currency} ${debtPaymentAmount} recorded successfully.`,
      });
      setIsDebtPaymentDialogOpen(false);
      setDebtPaymentAmount("");
      setPaymentNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to record debt payment",
        variant: "destructive",
      });
    },
  });

  const customerOverviewData = customerData ? {
    _id: customerData._id,
    name: customerData.name || 'Customer',
    email: customerData.email || '',
    phone: customerData.phone || customerData.phonenumber || '',
    address: customerData.address || '',
    totalPurchases: salesData?.data?.length || 0,
    totalSpent: salesData?.data?.reduce((sum: number, sale: any) => sum + parseFloat(String(sale.totalWithDiscount || sale.totalAmount || 0)), 0) || 0,
    outstandingBalance: parseFloat(String(customerData.outstandingBalance ?? 0)),
    walletBalance: parseFloat(String(customerData.wallet ?? 0)),
    lastPurchaseDate: salesData?.data?.[0]?.createdAt || '',
    memberSince: customerData.createdAt || '',
    status: 'Active',
    vipStatus: customerData.type === 'vip',
    customerType: customerData.type || customerData.customerType || 'retail'
  } : {
    _id: customerId || '',
    name: customerLoading ? 'Loading...' : 'Customer Not Found',
    email: '',
    phone: '',
    address: '',
    totalPurchases: 0,
    totalSpent: 0,
    outstandingBalance: 0,
    walletBalance: 0,
    lastPurchaseDate: '',
    memberSince: '',
    status: 'Active',
    vipStatus: false,
    customerType: 'retail'
  };

  // Convert sales data to transactions format
  const salesTransactions = (salesData?.data || []).map((sale: Sale) => {
    // Generate receipt number from sale ID or use available receiptno field
    const receiptNumber = (sale as any).receiptno || 
                         (sale as any).receiptNo || 
                         `R${sale._id?.slice(-8) || 'N/A'}`;
    
    return {
      _id: sale._id,
      date: sale.saleDate || sale.createdAt,
      type: sale.paymentTag === 'credit' ? 'credit' : 'purchase' as const,
      amount: (sale as any).totalWithDiscount || sale.totalAmount, // Use totalWithDiscount if available, fallback to totalAmount
      description: `${sale.items?.map(item => item.productName || item.product?.name).join(', ') || 'Sale'}`,
      status: sale.status === 'cashed' ? 'completed' : sale.status as 'completed' | 'pending' | 'cancelled',
      referenceNumber: receiptNumber,
      outstandingBalance: sale.outstandingBalance || 0,
      paymentMethod: sale.paymentTag,
      currency: sale.shopId?.currency || 'KES'
    };
  });

  // Calculate pagination
  const totalPages = Math.ceil(salesTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = salesTransactions.slice(startIndex, startIndex + itemsPerPage);

  // Reset current page when filter changes
  const handleFilterChange = (value: string) => {
    setSalesFilter(value);
    setCurrentPage(1);
  };

  // Get currency from customer data
  const currency = salesData?.data?.[0]?.shopId?.currency || 'KES';

  // Wallet deposit mutation
  const depositMutation = useMutation({
    mutationFn: async (depositData: { amount: number; paymentMethod: string; notes: string }) => {
      if (!customerId || !customerData) {
        throw new Error('Customer data not available');
      }

      const response = await apiRequest('POST', ENDPOINTS.customers.updateBalance(customerId), {
        amount: depositData.amount,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Deposit failed: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.customers.getPayments(customerId ?? ''), statementFilter] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: "Deposit Successful",
        description: `${currency} ${depositAmount} has been added to the wallet`,
      });
      setDepositAmount("");
      setIsDepositDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Deposit Failed",
        description: error.message || "Could not process the deposit",
        variant: "destructive",
      });
    },
  });

  // Fetch loyalty data for this customer
  const { data: loyaltyData, refetch: refetchLoyalty } = useQuery({
    queryKey: ['customer-loyalty', customerId],
    queryFn: async () => {
      const res = await apiRequest('GET', ENDPOINTS.customers.getLoyalty(customerId!));
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!customerId,
  });

  // Adjust loyalty points (admin only)
  const adjustLoyaltyMutation = useMutation({
    mutationFn: async ({ points, note }: { points: number; note: string }) => {
      const res = await apiRequest('POST', ENDPOINTS.customers.adjustLoyalty(customerId!), { points, note });
      return res.json();
    },
    onSuccess: () => {
      refetchLoyalty();
      queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] });
      setAdjustPoints("");
      setAdjustNote("");
      setIsAdjustDialogOpen(false);
      toast({ title: "Points updated", description: "Loyalty points adjusted successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err?.message || "Could not adjust points", variant: "destructive" });
    },
  });

  const handleAdjustLoyalty = () => {
    const pts = parseFloat(adjustPoints);
    if (isNaN(pts) || pts === 0) {
      toast({ title: "Invalid", description: "Enter a non-zero point amount", variant: "destructive" });
      return;
    }
    adjustLoyaltyMutation.mutate({ points: pts, note: adjustNote || "Manual adjustment" });
  };

  // Handle wallet deposit
  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid deposit amount",
        variant: "destructive",
      });
      return;
    }

    depositMutation.mutate({
      amount,
      paymentMethod: 'cash',
      notes: `Wallet deposit - ${currency} ${amount}`
    });
  };

  // Download customer statement as CSV
  const downloadStatementCSV = async () => {
    const customerName = customerOverviewData.name;
    const customerPhone = (customerData as any)?.phonenumber || (customerData as any)?.phone || '';
    const customerEmail = (customerData as any)?.email || '';
    const currentDate = new Date().toLocaleDateString();

    // Fetch shop name
    let shopName = 'Shop';
    const sid = String(customerData?.shop || shopIdForQuery || '');
    if (sid) {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('attendantToken');
        const res = await fetch(ENDPOINTS.shop.getAll, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const r = await res.json();
          const list: any[] = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
          const found = list.find((s: any) => String(s.id) === sid);
          if (found?.name) shopName = found.name;
        }
      } catch { /* ignore */ }
    }

    // Build merged statement rows (same logic as Statement tab and PDF)
    type CsvRow = { ts: number; date: string; description: string; ref: string; attendant: string; debit: number; credit: number; };
    const rows: CsvRow[] = [];

    (salesData?.data || []).forEach((sale: any) => {
      const isCredit = sale.status === 'credit' || Number(sale.outstandingBalance) > 0;
      if (!isCredit) return;
      const ts = new Date(sale.createdAt || sale.saleDate).getTime();
      const saleItems = sale.saleItems || sale.items || [];
      const productNames = saleItems.map((i: any) => i.product?.name || i.productName || i.name || 'Item').join(', ');
      rows.push({
        ts,
        date: new Date(ts).toLocaleDateString(),
        description: `Credit Sale${productNames ? ': ' + productNames : ''}`,
        ref: sale.receiptNo || sale.receiptno || `#${sale.id}`,
        attendant: sale.attendant?.username || '',
        debit: Number(sale.outstandingBalance) || Number(sale.totalWithDiscount || sale.totalAmount || 0),
        credit: 0,
      });
    });

    (customerPayments as any[]).forEach((p: any) => {
      const ts = new Date(p.createdAt).getTime();
      const pType = (p.type || '').toLowerCase();
      const isDebit = pType === 'withdraw';
      const descMap: Record<string, string> = { deposit: 'Wallet Deposit', withdraw: 'Wallet Withdrawal', payment: 'Debt Payment', refund: 'Refund' };
      const amount = Number(p.amount ?? p.totalAmount ?? 0);
      rows.push({
        ts,
        date: new Date(ts).toLocaleDateString(),
        description: descMap[pType] || 'Transaction',
        ref: p.paymentNo || `#${p.id}`,
        attendant: p.handledBy ? 'Staff' : 'System',
        debit: isDebit ? amount : 0,
        credit: isDebit ? 0 : amount,
      });
    });

    if (rows.length === 0) {
      toast({ title: "No Data", description: "No transactions found for this customer.", variant: "destructive" });
      return;
    }

    rows.sort((a, b) => a.ts - b.ts);

    let runningBalance = 0;
    const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;

    // Header block
    let csv = `${shopName} — Customer Account Statement\n`;
    csv += `Customer:,${q(customerName)}\n`;
    if (customerPhone) csv += `Phone:,${q(customerPhone)}\n`;
    if (customerEmail) csv += `Email:,${q(customerEmail)}\n`;
    csv += `Statement Date:,${q(currentDate)}\n`;
    csv += `\n`;

    // Column headers
    csv += `Date,Description,Reference,Attendant,Debit (${currency}),Credit (${currency}),Balance (${currency})\n`;

    rows.forEach(row => {
      runningBalance += row.debit - row.credit;
      const balanceStr = runningBalance > 0 ? `${runningBalance.toFixed(2)} Owing` : runningBalance < 0 ? `${Math.abs(runningBalance).toFixed(2)} Credit` : '0.00';
      csv += `${q(row.date)},${q(row.description)},${q(row.ref)},${q(row.attendant)},`;
      csv += `${row.debit > 0 ? row.debit.toFixed(2) : ''},${row.credit > 0 ? row.credit.toFixed(2) : ''},${q(balanceStr)}\n`;
    });

    // Summary footer
    const totalDebits = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredits = rows.reduce((s, r) => s + r.credit, 0);
    const closing = runningBalance > 0 ? `${runningBalance.toFixed(2)} Owing` : `${Math.abs(runningBalance).toFixed(2)} Credit`;
    csv += `\n`;
    csv += `Totals,,,,${totalDebits.toFixed(2)},${totalCredits.toFixed(2)},${q(closing)}\n`;

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${customerName.replace(/\s+/g, '_')}_Statement_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "CSV Downloaded", description: "Customer statement downloaded successfully." });
  };

  // Download customer statement as PDF
  const downloadStatementPDF = async () => {
    const customerName = customerOverviewData.name;
    const currentDate = new Date().toLocaleDateString();

    // Fetch shop data fresh at click time using the shops list endpoint (always available)
    let fetchedShop: any = shopData;
    const sid = String(customerData?.shop || shopIdForQuery || '');
    if (sid) {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('attendantToken');
        const res = await fetch(ENDPOINTS.shop.getAll, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const r = await res.json();
          const list: any[] = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
          fetchedShop = list.find((s: any) => String(s.id) === sid) ?? fetchedShop;
        }
      } catch { /* ignore */ }
    }
    const shopName = fetchedShop?.name || 'Shop';
    const shopAddress = fetchedShop?.address || fetchedShop?.receiptAddress || '';
    const shopPhone = fetchedShop?.contact || fetchedShop?.phone || '';
    const shopEmail = fetchedShop?.receiptEmail || fetchedShop?.email || '';

    const allSales: any[] = salesData?.data || [];
    const allPayments: any[] = (customerPayments as any[]) || [];

    if (allSales.length === 0 && allPayments.length === 0) {
      toast({
        title: "No History",
        description: "No transaction history available for this customer",
        variant: "destructive",
      });
      return;
    }

    // Build unified transaction list
    type TxRow = { ts: number; date: string; description: string; ref: string; attendant: string; debit: number; credit: number; };
    const rows: TxRow[] = [];

    // Add sales
    allSales.forEach((sale: any) => {
      const ts = new Date(sale.createdAt || sale.saleDate).getTime();
      const ref = sale.receiptNo || sale.receiptno || sale._id?.slice(-8) || 'N/A';
      const attendant = sale.attendant?.username || sale.attendantId?.username || '';
      const amount = Number(sale.totalWithDiscount || sale.totalAmount || 0);
      const tag = (sale.paymentType || sale.paymentTag || '').toLowerCase();
      const isCredit = sale.status === 'credit' || Number(sale.outstandingBalance) > 0;
      const saleItems = sale.saleItems || sale.items || [];
      const productNames = saleItems.map((i: any) => i.product?.name || i.productName || i.name || 'Item').join(', ');
      const description = `Sale${productNames ? ': ' + productNames.substring(0, 60) : ''}`;
      const payLabel = isCredit ? 'Credit' : tag === 'wallet' ? 'Wallet' : tag === 'mpesa' ? 'M-Pesa' : tag === 'bank' ? 'Bank' : 'Cash';

      if (isCredit) {
        // Credit sale — customer owes the outstanding amount
        const creditAmount = Number(sale.outstandingBalance) || amount;
        rows.push({ ts, date: new Date(ts).toLocaleDateString(), description: `${description} [${payLabel}]`, ref, attendant, debit: creditAmount, credit: 0 });
      } else if (tag === 'wallet') {
        // Paid from wallet — deducted from wallet
        rows.push({ ts, date: new Date(ts).toLocaleDateString(), description: `${description} [${payLabel}]`, ref, attendant, debit: amount, credit: 0 });
      } else {
        // Cash/M-Pesa/Bank paid sale — informational, no balance impact
        rows.push({ ts, date: new Date(ts).toLocaleDateString(), description: `${description} [${payLabel} - Paid]`, ref, attendant, debit: 0, credit: 0 });
      }
    });

    // Add wallet transactions
    allPayments.forEach((payment: any) => {
      const ts = new Date(payment.createdAt).getTime();
      const ref = payment.paymentNo || payment._id?.slice(-8) || 'N/A';
      const attendant = payment.attendantId?.username || (payment.handledBy ? 'Staff' : 'System');
      const amount = Number(payment.amount ?? payment.totalAmount ?? 0);
      const pType = (payment.type || '').toLowerCase();
      const isDebit = pType === 'withdraw';
      const descMap: Record<string, string> = {
        deposit: 'Wallet Deposit',
        withdraw: 'Wallet Withdrawal',
        payment: 'Debt Payment',
        refund: 'Refund',
      };
      rows.push({
        ts, date: new Date(ts).toLocaleDateString(),
        description: descMap[pType] || 'Wallet Transaction',
        ref, attendant,
        debit: isDebit ? amount : 0,
        credit: isDebit ? 0 : amount,
      });
    });

    // Sort by date ascending
    rows.sort((a, b) => a.ts - b.ts);

    // Compute running balance (positive = customer has credit, negative = customer owes)
    let runningBalance = 0;
    const transactionRows = rows.map(row => {
      runningBalance += row.credit - row.debit;
      const balanceColor = runningBalance < 0 ? '#dc2626' : '#059669';
      const balanceText = `${currency} ${Math.abs(runningBalance).toFixed(2)}${runningBalance > 0 ? ' Owing' : ''}`;
      const debitCell = row.debit > 0
        ? `<span style="color:#dc2626;font-weight:600;">${currency} ${row.debit.toFixed(2)}</span>`
        : `<span style="color:#9ca3af;">-</span>`;
      const creditCell = row.credit > 0
        ? `<span style="color:#059669;font-weight:600;">${currency} ${row.credit.toFixed(2)}</span>`
        : `<span style="color:#9ca3af;">-</span>`;
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${row.date}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${row.description}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${row.ref}<br/><span style="font-size:11px;color:#6b7280;">${row.attendant}</span></td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${debitCell}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${creditCell}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:${balanceColor};">${balanceText}</td>
        </tr>
      `;
    }).join('');

    // Summary
    const totalDebits = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredits = rows.reduce((s, r) => s + r.credit, 0);
    const closingBalance = totalCredits - totalDebits;

    // Create print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Customer Statement - ${customerName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 20px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .statement-title {
              font-size: 20px;
              margin-bottom: 20px;
            }
            .customer-info {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
              background-color: #f8fafc;
              padding: 20px;
              border-radius: 8px;
            }
            .info-section {
              flex: 1;
            }
            .info-label {
              font-weight: bold;
              color: #374151;
              margin-bottom: 5px;
            }
            .info-value {
              color: #6b7280;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background-color: #2563eb;
              color: white;
              padding: 12px 8px;
              text-align: left;
              font-weight: 600;
            }
            th:last-child, td:last-child {
              text-align: right;
            }
            .summary {
              margin-top: 30px;
              padding: 20px;
              background-color: #f0f9ff;
              border-radius: 8px;
              border-left: 4px solid #2563eb;
            }
            .summary-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 15px;
              color: #2563eb;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
            }
            .summary-item {
              text-align: center;
            }
            .summary-value {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .summary-label {
              color: #6b7280;
              font-size: 14px;
            }
            @media print {
              body { margin: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">${shopName}</div>
            ${shopAddress ? `<div style="font-size:13px;color:#4b5563;margin-top:2px;">${shopAddress}</div>` : ''}
            ${shopPhone ? `<div style="font-size:13px;color:#4b5563;">Tel: ${shopPhone}</div>` : ''}
            ${shopEmail ? `<div style="font-size:13px;color:#4b5563;">${shopEmail}</div>` : ''}
            <div class="statement-title" style="margin-top:10px;">Customer Account Statement</div>
          </div>
          
          <div class="customer-info">
            <div class="info-section">
              <div class="info-label">Customer Name:</div>
              <div class="info-value">${customerName}</div>
            </div>
            <div class="info-section">
              <div class="info-label">Statement Date:</div>
              <div class="info-value">${currentDate}</div>
            </div>
            <div class="info-section">
              <div class="info-label">Phone:</div>
              <div class="info-value">${(customerData as any)?.phonenumber || (customerData as any)?.phone || 'N/A'}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:90px;">Date</th>
                <th>Description</th>
                <th style="width:120px;">Reference</th>
                <th style="text-align:right;width:100px;">Debit</th>
                <th style="text-align:right;width:100px;">Credit</th>
                <th style="text-align:right;width:110px;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${transactionRows}
            </tbody>
            <tfoot>
              <tr style="background:#f1f5f9;font-weight:700;">
                <td colspan="3" style="padding:10px 8px;border-top:2px solid #2563eb;">Totals</td>
                <td style="padding:10px 8px;border-top:2px solid #2563eb;text-align:right;color:#dc2626;">${currency} ${totalDebits.toFixed(2)}</td>
                <td style="padding:10px 8px;border-top:2px solid #2563eb;text-align:right;color:#059669;">${currency} ${totalCredits.toFixed(2)}</td>
                <td style="padding:10px 8px;border-top:2px solid #2563eb;text-align:right;color:${closingBalance < 0 ? '#dc2626' : '#059669'};">
                  ${currency} ${Math.abs(closingBalance).toFixed(2)}${closingBalance < 0 ? ' Owing' : ' Credit'}
                </td>
              </tr>
            </tfoot>
          </table>

          <div class="summary">
            <div class="summary-title">Account Summary</div>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-value" style="color:#dc2626;">${currency} ${totalDebits.toFixed(2)}</div>
                <div class="summary-label">Total Debits</div>
              </div>
              <div class="summary-item">
                <div class="summary-value" style="color:#059669;">${currency} ${totalCredits.toFixed(2)}</div>
                <div class="summary-label">Total Credits</div>
              </div>
              <div class="summary-item">
                <div class="summary-value" style="color:${closingBalance < 0 ? '#dc2626' : '#059669'};">
                  ${currency} ${Math.abs(closingBalance).toFixed(2)}
                </div>
                <div class="summary-label">${closingBalance < 0 ? 'Amount Owing' : 'Credit Balance'}</div>
              </div>
            </div>
          </div>

        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Trigger print after content loads
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 600);

    toast({
      title: "Statement Ready",
      description: "Customer statement is opening for print/save",
    });
  };

  // Email statement to customer
  const emailStatementToCustomer = async () => {
    const customerName = customerOverviewData.name;
    const customerEmail = (customerData as any)?.email || '';
    const currentDate = new Date().toLocaleDateString();
    const currency = (customerData as any)?.currency || 'KES';

    // Fetch shop data
    let fetchedShop: any = shopData;
    const sid = String(customerData?.shop || shopIdForQuery || '');
    if (sid) {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('attendantToken');
        const res = await fetch(ENDPOINTS.shop.getAll, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const r = await res.json();
          const list: any[] = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
          fetchedShop = list.find((s: any) => String(s.id) === sid) ?? fetchedShop;
        }
      } catch { /* ignore */ }
    }
    const shopName = fetchedShop?.name || 'Shop';
    const shopAddress = fetchedShop?.address || fetchedShop?.receiptAddress || '';
    const shopPhone = fetchedShop?.contact || fetchedShop?.phone || '';
    const shopEmail = fetchedShop?.receiptEmail || fetchedShop?.email || '';

    const allSales: any[] = salesData?.data || [];
    const allPayments: any[] = (customerPayments as any[]) || [];

    type TxRow = { ts: number; date: string; description: string; ref: string; attendant: string; debit: number; credit: number; };
    const rows: TxRow[] = [];

    allSales.forEach((sale: any) => {
      const ts = new Date(sale.createdAt || sale.saleDate).getTime();
      const ref = sale.receiptNo || sale.receiptno || sale._id?.slice(-8) || 'N/A';
      const attendant = sale.attendant?.username || sale.attendantId?.username || '';
      const amount = Number(sale.totalWithDiscount || sale.totalAmount || 0);
      const tag = (sale.paymentType || sale.paymentTag || '').toLowerCase();
      const isCredit = sale.status === 'credit' || Number(sale.outstandingBalance) > 0;
      const saleItems = sale.saleItems || sale.items || [];
      const productNames = saleItems.map((i: any) => i.product?.name || i.productName || i.name || 'Item').join(', ');
      const description = `Sale${productNames ? ': ' + productNames.substring(0, 60) : ''}`;
      const payLabel = isCredit ? 'Credit' : tag === 'wallet' ? 'Wallet' : tag === 'mpesa' ? 'M-Pesa' : tag === 'bank' ? 'Bank' : 'Cash';

      if (isCredit) {
        const creditAmount = Number(sale.outstandingBalance) || amount;
        rows.push({ ts, date: new Date(ts).toLocaleDateString(), description: `${description} [${payLabel}]`, ref, attendant, debit: creditAmount, credit: 0 });
      } else if (tag === 'wallet') {
        rows.push({ ts, date: new Date(ts).toLocaleDateString(), description: `${description} [${payLabel}]`, ref, attendant, debit: amount, credit: 0 });
      } else {
        rows.push({ ts, date: new Date(ts).toLocaleDateString(), description: `${description} [${payLabel} - Paid]`, ref, attendant, debit: 0, credit: 0 });
      }
    });

    allPayments.forEach((payment: any) => {
      const ts = new Date(payment.createdAt).getTime();
      const ref = payment.paymentNo || payment._id?.slice(-8) || 'N/A';
      const attendant = payment.attendantId?.username || (payment.handledBy ? 'Staff' : 'System');
      const amount = Number(payment.amount ?? payment.totalAmount ?? 0);
      const pType = (payment.type || '').toLowerCase();
      const isDebit = pType === 'withdraw';
      const descMap: Record<string, string> = { deposit: 'Wallet Deposit', withdraw: 'Wallet Withdrawal', payment: 'Debt Payment', refund: 'Refund' };
      rows.push({ ts, date: new Date(ts).toLocaleDateString(), description: descMap[pType] || 'Wallet Transaction', ref, attendant, debit: isDebit ? amount : 0, credit: isDebit ? 0 : amount });
    });

    rows.sort((a, b) => a.ts - b.ts);

    const totalDebits = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredits = rows.reduce((s, r) => s + r.credit, 0);
    const closingBalance = totalCredits - totalDebits;

    // Build PDF using jspdf + autoTable
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const blue: [number, number, number] = [37, 99, 235];
    const gray: [number, number, number] = [107, 114, 128];

    // Shop header
    doc.setFontSize(16);
    doc.setTextColor(...blue);
    doc.setFont('helvetica', 'bold');
    doc.text(shopName, pageW / 2, 18, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');
    let headerY = 23;
    if (shopAddress) { doc.text(shopAddress, pageW / 2, headerY, { align: 'center' }); headerY += 4; }
    if (shopPhone)   { doc.text(`Tel: ${shopPhone}`, pageW / 2, headerY, { align: 'center' }); headerY += 4; }
    if (shopEmail)   { doc.text(shopEmail, pageW / 2, headerY, { align: 'center' }); headerY += 4; }

    // Title line
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.5);
    doc.line(14, headerY + 1, pageW - 14, headerY + 1);
    headerY += 5;
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Account Statement', pageW / 2, headerY, { align: 'center' });
    headerY += 8;

    // Customer info block
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Customer:', 14, headerY);
    doc.setFont('helvetica', 'normal');
    doc.text(customerName, 38, headerY);
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', pageW / 2, headerY);
    doc.setFont('helvetica', 'normal');
    doc.text(currentDate, pageW / 2 + 14, headerY);
    headerY += 5;
    const custPhone = (customerData as any)?.phonenumber || (customerData as any)?.phone || '';
    if (custPhone) {
      doc.setFont('helvetica', 'bold');
      doc.text('Phone:', 14, headerY);
      doc.setFont('helvetica', 'normal');
      doc.text(custPhone, 38, headerY);
      headerY += 5;
    }
    headerY += 2;

    // Transaction table
    let runningBalance = 0;
    const tableBody = rows.map(row => {
      runningBalance += row.credit - row.debit;
      const balStr = `${currency} ${Math.abs(runningBalance).toFixed(2)}${runningBalance > 0 ? ' Owing' : runningBalance < 0 ? ' Credit' : ''}`;
      return [
        row.date,
        row.description,
        row.ref + (row.attendant ? `\n${row.attendant}` : ''),
        row.debit > 0 ? `${currency} ${row.debit.toFixed(2)}` : '-',
        row.credit > 0 ? `${currency} ${row.credit.toFixed(2)}` : '-',
        balStr,
      ];
    });

    // Totals row
    const closingStr = `${currency} ${Math.abs(closingBalance).toFixed(2)}${closingBalance < 0 ? ' Owing' : ' Credit'}`;
    tableBody.push([
      'TOTALS', '', '',
      `${currency} ${totalDebits.toFixed(2)}`,
      `${currency} ${totalCredits.toFixed(2)}`,
      closingStr,
    ]);

    autoTable(doc, {
      startY: headerY,
      head: [['Date', 'Description', 'Ref / By', `Debit (${currency})`, `Credit (${currency})`, 'Balance']],
      body: tableBody,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: blue, textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 65 },
        2: { cellWidth: 28 },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 27, halign: 'right' },
      },
      didParseCell: (data: any) => {
        // Style totals row bold
        if (data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
        // Color debit column red, credit green in body rows
        if (data.section === 'body' && data.row.index < tableBody.length - 1) {
          if (data.column.index === 3 && data.cell.text[0] !== '-') data.cell.styles.textColor = [220, 38, 38];
          if (data.column.index === 4 && data.cell.text[0] !== '-') data.cell.styles.textColor = [5, 150, 105];
          if (data.column.index === 5) {
            const txt = String(data.cell.text[0] || '');
            data.cell.styles.textColor = txt.includes('Owing') ? [220, 38, 38] : [5, 150, 105];
          }
        }
      },
    });

    const pdfBase64 = doc.output('datauristring').split(',')[1];

    setIsSendingEmail(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('attendantToken');
      const res = await fetch(ENDPOINTS.customers.emailStatement(String(customerId)), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `Account Statement — ${customerName}`,
          pdfBase64,
          customerName,
          toEmail: customerEmail || undefined,
        }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Server error ${res.status}`);
      }
      if (data?.data?.sent === false) {
        toast({ title: "Email Not Sent", description: data.data.reason || "Email provider is not configured.", variant: "destructive" });
      } else {
        toast({ title: "Statement Sent", description: `Statement emailed to ${data?.data?.to || customerEmail}` });
      }
    } catch (err: any) {
      toast({ title: "Email Failed", description: err.message || "Could not send the statement.", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCustomerTypeColor = (type: string) => {
    switch (type) {
      case 'vip': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'wholesale': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'regular': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'purchase': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'payment': return 'bg-green-100 text-green-800 border-green-200';
      case 'refund': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'credit': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };



  return (
    <DashboardLayout title="Customer Overview">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <div className="space-y-2">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign(customersRoute)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold">Customer Overview</h1>
          </div>
        </div>

        {/* Customer Header - Mobile Responsive */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl sm:text-2xl font-bold truncate">{customerOverviewData.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge className={`text-xs ${getStatusColor(customerOverviewData.status || 'Active')}`}>
                      {(customerOverviewData.status || 'Active').charAt(0).toUpperCase() + (customerOverviewData.status || 'Active').slice(1)}
                    </Badge>
                    <Badge className={`text-xs ${getCustomerTypeColor(customerOverviewData.customerType || 'VIP')}`}>
                      {(customerOverviewData.customerType || 'VIP').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-row sm:flex-col gap-3 sm:gap-2 border-t sm:border-t-0 pt-4 sm:pt-0 sm:text-right">
                {customerOverviewData.outstandingBalance > 0 && (
                  <div className="flex-1 sm:flex-none">
                    <div className="text-lg sm:text-xl font-bold text-red-600">
                      {currency} {customerOverviewData.outstandingBalance.toLocaleString()}
                    </div>
                    <div className="text-xs text-red-500">Outstanding Debt</div>
                  </div>
                )}
                {customerOverviewData.walletBalance > 0 && (
                  <div className="flex-1 sm:flex-none">
                    <div className="text-lg sm:text-xl font-bold text-green-600">
                      {currency} {customerOverviewData.walletBalance.toLocaleString()}
                    </div>
                    <div className="text-xs text-green-500">Wallet Credit</div>
                  </div>
                )}
                {customerOverviewData.outstandingBalance === 0 && customerOverviewData.walletBalance === 0 && (
                  <div className="flex-1 sm:flex-none">
                    <div className="text-lg sm:text-xl font-bold text-gray-500">{currency} 0.00</div>
                    <div className="text-xs text-gray-400">No balance</div>
                  </div>
                )}
                <div className="flex flex-col gap-1 mt-1">
                  {customerOverviewData.outstandingBalance > 0 && (
                    <Button
                      onClick={() => setIsDebtPaymentDialogOpen(true)}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Pay Debt
                    </Button>
                  )}
                  <Button
                    onClick={() => setIsDepositDialogOpen(true)}
                    size="sm"
                    variant="outline"
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add to Wallet
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deposit Dialog - Moved from wallet tab */}
        <Dialog open={isDepositDialogOpen} onOpenChange={setIsDepositDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deposit to Wallet</DialogTitle>
              <DialogDescription>
                Add money to the customer's wallet balance
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDepositDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDeposit}>
                Deposit {currency} {depositAmount || '0.00'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>



        {/* Detailed Information Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="statement">Statement</TabsTrigger>
            <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
            <TabsTrigger value="contact">Contact Info</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Sales History</CardTitle>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Select value={salesFilter} onValueChange={handleFilterChange}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sales</SelectItem>
                        <SelectItem value="cash">Cash Sales</SelectItem>
                        <SelectItem value="credit">Credit Sales</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Receipt No</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            Loading sales data...
                          </TableCell>
                        </TableRow>
                      ) : paginatedTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                            No sales found for this customer
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedTransactions.map((transaction: any) => (
                          <TableRow key={transaction._id}>
                            <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge className={getTransactionTypeColor(transaction.type)}>
                                {transaction.paymentMethod?.charAt(0)?.toUpperCase() + transaction.paymentMethod?.slice(1) || transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">{transaction.referenceNumber}</TableCell>
                            <TableCell className="text-right">
                              <span className="font-medium text-green-600">
                                {transaction.currency} {transaction.amount.toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Link 
                                href={`/receipt/${transaction._id}`}
                                onClick={() => {
                                  const saleData = salesData?.data?.find((sale: any) => sale._id === transaction._id);
                                  if (saleData) {
                                    // Store in window object for immediate access
                                    (window as any).__receiptData = saleData;
                                  }
                                }}
                              >
                                <Button variant="outline" size="sm">
                                  View Receipt
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-gray-500">
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, salesTransactions.length)} of {salesTransactions.length} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="statement" className="space-y-4">
            {(() => {
              // Build merged statement rows: credit sales + wallet transactions
              type StmtRow = { ts: number; date: string; description: string; ref: string; attendant: string; debit: number; credit: number; };
              const stmtRows: StmtRow[] = [];

              (salesData?.data || []).forEach((sale: any) => {
                const isCredit = sale.status === 'credit' || Number(sale.outstandingBalance) > 0;
                if (!isCredit) return;
                const ts = new Date(sale.createdAt || sale.saleDate).getTime();
                const saleItems = sale.saleItems || sale.items || [];
                const productNames = saleItems.map((i: any) => i.product?.name || i.productName || i.name || 'Item').join(', ');
                stmtRows.push({
                  ts,
                  date: new Date(ts).toLocaleDateString(),
                  description: `Credit Sale${productNames ? ': ' + productNames.substring(0, 50) : ''}`,
                  ref: sale.receiptNo || sale.receiptno || `#${sale.id}`,
                  attendant: sale.attendant?.username || '',
                  debit: Number(sale.outstandingBalance) || Number(sale.totalWithDiscount || sale.totalAmount || 0),
                  credit: 0,
                });
              });

              (customerPayments as any[]).forEach((p: any) => {
                const ts = new Date(p.createdAt).getTime();
                const pType = (p.type || '').toLowerCase();
                const isDebit = pType === 'withdraw';
                const descMap: Record<string, string> = { deposit: 'Wallet Deposit', withdraw: 'Wallet Withdrawal', payment: 'Debt Payment', refund: 'Refund', return: 'Sale Return' };
                const amount = Number(p.amount ?? p.totalAmount ?? 0);
                stmtRows.push({
                  ts,
                  date: new Date(ts).toLocaleDateString(),
                  description: descMap[pType] || 'Transaction',
                  ref: p.paymentNo || `#${p.id}`,
                  attendant: p.handledBy ? 'Staff' : 'System',
                  debit: isDebit ? amount : 0,
                  credit: isDebit ? 0 : amount,
                });
              });

              stmtRows.sort((a, b) => a.ts - b.ts);

              let runningBalance = 0;
              const stmtWithBalance = stmtRows.map(r => {
                runningBalance += r.debit - r.credit;
                return { ...r, balance: runningBalance };
              });

              const totalDebits = stmtRows.reduce((s, r) => s + r.debit, 0);
              const totalCredits = stmtRows.reduce((s, r) => s + r.credit, 0);

              return (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">Account Statement</CardTitle>
                      <div className="flex items-center gap-1">
                        <Button onClick={downloadStatementCSV} variant="outline" size="sm" className="h-7 px-2 text-xs">
                          <Download className="h-3 w-3 mr-1" />
                          CSV
                        </Button>
                        <Button onClick={downloadStatementPDF} variant="outline" size="sm" className="h-7 px-2 text-xs">
                          <Download className="h-3 w-3 mr-1" />
                          PDF
                        </Button>
                        <Button onClick={emailStatementToCustomer} variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={isSendingEmail}>
                          <Mail className="h-3 w-3 mr-1" />
                          {isSendingEmail ? "Sending…" : "Email"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="h-8">
                            <TableHead className="py-1 px-2 text-xs">Date</TableHead>
                            <TableHead className="py-1 px-2 text-xs">Description</TableHead>
                            <TableHead className="py-1 px-2 text-xs">Ref / By</TableHead>
                            <TableHead className="py-1 px-2 text-xs text-right">Debit</TableHead>
                            <TableHead className="py-1 px-2 text-xs text-right">Credit</TableHead>
                            <TableHead className="py-1 px-2 text-xs text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(isLoadingPayments || salesLoading) ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-3 text-xs">Loading statement...</TableCell></TableRow>
                          ) : stmtWithBalance.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-3 text-xs text-gray-500">No transactions found</TableCell></TableRow>
                          ) : stmtWithBalance.map((row, i) => (
                            <TableRow key={i} className="h-7 hover:bg-gray-50">
                              <TableCell className="py-1 px-2 text-xs whitespace-nowrap">{row.date}</TableCell>
                              <TableCell className="py-1 px-2 text-xs max-w-[180px] truncate">{row.description}</TableCell>
                              <TableCell className="py-1 px-2 text-xs whitespace-nowrap">
                                <span>{row.ref}</span>
                                {row.attendant && <span className="text-gray-400 ml-1">· {row.attendant}</span>}
                              </TableCell>
                              <TableCell className="py-1 px-2 text-xs text-right font-medium">
                                {row.debit > 0 ? <span className="text-red-600">{currency} {row.debit.toFixed(2)}</span> : <span className="text-gray-300">—</span>}
                              </TableCell>
                              <TableCell className="py-1 px-2 text-xs text-right font-medium">
                                {row.credit > 0 ? <span className="text-green-600">{currency} {row.credit.toFixed(2)}</span> : <span className="text-gray-300">—</span>}
                              </TableCell>
                              <TableCell className="py-1 px-2 text-xs text-right font-semibold">
                                <span className={row.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                                  {currency} {Math.abs(row.balance).toFixed(2)}
                                  {row.balance > 0 && <span className="ml-1 font-normal opacity-70">Owing</span>}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        {stmtWithBalance.length > 0 && (
                          <tfoot>
                            <TableRow className="bg-gray-50 border-t-2 h-8">
                              <TableCell colSpan={3} className="py-1 px-2 text-xs font-bold">Totals</TableCell>
                              <TableCell className="py-1 px-2 text-xs text-right font-bold text-red-600">{currency} {totalDebits.toFixed(2)}</TableCell>
                              <TableCell className="py-1 px-2 text-xs text-right font-bold text-green-600">{currency} {totalCredits.toFixed(2)}</TableCell>
                              <TableCell className="py-1 px-2 text-xs text-right font-bold">
                                <span className={runningBalance > 0 ? 'text-red-600' : 'text-green-600'}>
                                  {currency} {Math.abs(runningBalance).toFixed(2)}
                                  {runningBalance > 0 ? ' Owing' : ' Credit'}
                                </span>
                              </TableCell>
                            </TableRow>
                          </tfoot>
                        )}
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>


          {/* ── LOYALTY TAB ─────────────────────────────────────────── */}
          <TabsContent value="loyalty" className="space-y-4">
            {/* Balance summary card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <CardTitle>Loyalty Points</CardTitle>
                  </div>
                  {loyaltyData?.shopSettings?.loyaltyEnabled === false && (
                    <Badge variant="secondary">Programme disabled for this shop</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-yellow-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                    <p className="text-3xl font-bold text-yellow-600">
                      {(loyaltyData?.loyaltyPoints ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">points</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Earn Rate</p>
                    <p className="text-xl font-bold text-blue-600">
                      {loyaltyData?.shopSettings?.pointsPerAmount ?? 0} pts
                    </p>
                    <p className="text-xs text-gray-400 mt-1">per KES spent</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Point Value</p>
                    <p className="text-xl font-bold text-green-600">
                      KES {loyaltyData?.shopSettings?.pointsValue ?? 0}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">per point</p>
                  </div>
                </div>

                {/* Redemption value summary */}
                {(loyaltyData?.loyaltyPoints ?? 0) > 0 && (loyaltyData?.shopSettings?.pointsValue ?? 0) > 0 && (
                  <div className="mt-4 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium text-gray-700">Total redemption value</span>
                    </div>
                    <span className="text-lg font-bold text-yellow-700">
                      KES {((loyaltyData.loyaltyPoints ?? 0) * (loyaltyData.shopSettings.pointsValue ?? 0)).toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Admin adjust button */}
                <div className="mt-4 flex justify-end">
                  <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Adjust Points
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Adjust Loyalty Points</DialogTitle>
                        <DialogDescription>
                          Enter a positive number to add points or a negative number to deduct points.
                          Current balance: <strong>{(loyaltyData?.loyaltyPoints ?? 0).toLocaleString()} pts</strong>
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="adj-points">Points (+ to add, - to deduct)</Label>
                          <Input
                            id="adj-points"
                            type="number"
                            placeholder="e.g. 50 or -20"
                            value={adjustPoints}
                            onChange={(e) => setAdjustPoints(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="adj-note">Note (optional)</Label>
                          <Input
                            id="adj-note"
                            placeholder="Reason for adjustment"
                            value={adjustNote}
                            onChange={(e) => setAdjustNote(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAdjustDialogOpen(false)}>Cancel</Button>
                        <Button
                          onClick={handleAdjustLoyalty}
                          disabled={adjustLoyaltyMutation.isPending}
                        >
                          {adjustLoyaltyMutation.isPending ? "Saving..." : "Apply Adjustment"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Transaction history */}
            <Card>
              <CardHeader>
                <CardTitle>Point History</CardTitle>
                <CardDescription>Last 50 loyalty transactions</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                        <TableHead className="text-right">Balance After</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!loyaltyData && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-gray-400 py-8">Loading...</TableCell>
                        </TableRow>
                      )}
                      {loyaltyData && loyaltyData.transactions?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-gray-400 py-8">No loyalty transactions yet</TableCell>
                        </TableRow>
                      )}
                      {loyaltyData?.transactions?.map((tx: any) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              tx.type === "earn" ? "default" :
                              tx.type === "redeem" ? "destructive" : "secondary"
                            } className="capitalize text-xs">
                              {tx.type}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${parseFloat(tx.points) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {parseFloat(tx.points) >= 0 ? '+' : ''}{parseFloat(tx.points).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-gray-700">
                            {parseFloat(tx.balanceAfter).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{tx.note || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>

              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Email Address</p>
                        <p className="font-medium">{customerOverviewData.email || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Phone Number</p>
                        <p className="font-medium">{customerOverviewData.phone || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <MapPin className="h-5 w-5 text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm text-gray-600">Address</p>
                        <p className="font-medium">{customerOverviewData.address || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Debt Payment Dialog */}
        <Dialog open={isDebtPaymentDialogOpen} onOpenChange={setIsDebtPaymentDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Customer Debt Payment</DialogTitle>
              <DialogDescription>
                Record a payment made by the customer to reduce their outstanding debt.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="debt-amount">Payment Amount</Label>
                <Input
                  id="debt-amount"
                  type="number"
                  step="0.01"
                  value={debtPaymentAmount}
                  onChange={(e) => setDebtPaymentAmount(e.target.value)}
                  placeholder="Enter payment amount"
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Outstanding balance: {currency} {customerOverviewData.outstandingBalance.toFixed(2)}
                </p>
              </div>
              <div>
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="payment-notes">Notes (Optional)</Label>
                <Input
                  id="payment-notes"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Payment notes or reference"
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDebtPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const amount = parseFloat(debtPaymentAmount);
                  if (amount > 0) {
                    debtPaymentMutation.mutate({
                      amount: amount,
                      paymentMethod: paymentMethod,
                      notes: paymentNotes
                    });
                  }
                }}
                disabled={!debtPaymentAmount || parseFloat(debtPaymentAmount) <= 0 || debtPaymentMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {debtPaymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}