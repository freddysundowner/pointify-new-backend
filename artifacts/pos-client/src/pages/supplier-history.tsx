import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { 
  Calendar, 
  Download, 
  Filter, 
  Search, 
  Package, 
  DollarSign, 
  Receipt,
  ChevronLeft,
  ChevronRight,
  FileText,
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Purchase {
  _id: string;
  purchaseNo: string;
  supplier: {
    _id: string;
    name: string;
  };
  totalAmount: number;
  amountPaid: number;
  createdAt: string;
  status: string;
  items: Array<{
    product: { name: string };
    quantity: number;
    unitPrice: number;
  }>;
  payments?: Array<{
    amount: number;
    paymentNo: string;
    date: string;
    balance: number;
  }>;
  shopId: {
    currency: string;
  };
}

export default function SupplierHistoryPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  // Parse supplier ID from URL params
  const searchParams = new URLSearchParams(window.location.search);
  const supplierId = searchParams.get('supplierId');
  const supplierName = decodeURIComponent(searchParams.get('supplierName') || '');
  

  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);
  
  // Get admin data for shop context
  const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
  const shopId = adminData?.primaryShop?._id;
  const shopCurrency = adminData?.primaryShop?.currency || 'KES';

  // Fetch purchase analytics for summary cards
  const { data: analyticsData } = useQuery({
    queryKey: ['/api/analysis/report/purchases', supplierId, dateFrom, dateTo, shopId, statusFilter],
    queryFn: async () => {
      if (!supplierId || !shopId) return null;
      
      const params = new URLSearchParams();
      params.append('shopid', shopId);
      params.append('supplierId', supplierId);
      // Always include date parameters, use current date if not set
      const fromDate = dateFrom || new Date().toISOString().split('T')[0];
      const toDate = dateTo || new Date().toISOString().split('T')[0];
      params.append('fromDate', fromDate);
      params.append('toDate', toDate);
      
      // Add status filter to analytics (map to payment type)
      if (statusFilter !== 'all') {
        const paymentType = statusFilter === 'paid' ? 'cash' : 'credit';
        params.append('paymentType', paymentType);
      }
      
      console.log('Analytics API call:', `/api/analysis/report/purchases?${params.toString()}`);
      
      const response = await apiRequest('GET', `/api/analysis/report/purchases?${params.toString()}`);
      return await response.json();
    },
    enabled: !!supplierId && !!shopId
  });

  // Fetch supplier purchase history
  const { data: purchasesData, isLoading, refetch } = useQuery({
    queryKey: ['/api/purchases', 'supplier-history', supplierId, currentPage, itemsPerPage, searchTerm, statusFilter, dateFrom, dateTo],
    queryFn: async () => {
      if (!supplierId || !shopId) return { data: [], count: 0, totalPages: 0 };
      
      const attendantId = adminData?.attendantId?._id || adminData?._id;
      
      const params = new URLSearchParams();
      params.append('shopId', shopId);
      params.append('supplierId', supplierId);
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());
      params.append('paginated', 'true');
      
      if (attendantId) params.append('attendantId', attendantId);
      if (searchTerm) params.append('purchaseNo', searchTerm); // Filter by purchase number
      if (statusFilter !== 'all') {
        // Map status to payment type: paid -> cash, credit -> credit
        const paymentType = statusFilter === 'paid' ? 'cash' : 'credit';
        params.append('paymentType', paymentType);
      }
      if (dateFrom) params.append('start', dateFrom);
      if (dateTo) params.append('end', dateTo);
      
      const response = await apiRequest('GET', `/api/purchases?${params.toString()}`);
      const data = await response.json();
      
      // Handle different response formats
      if (Array.isArray(data)) {
        // Direct array response
        return {
          data: data,
          count: data.length,
          totalPages: Math.ceil(data.length / itemsPerPage),
          currentPage: currentPage
        };
      } else if (data && data.data) {
        // Paginated response
        return data;
      } else {
        // Fallback
        return { data: [], count: 0, totalPages: 0, currentPage: 1 };
      }
    },
    enabled: !!supplierId && !!shopId,
    staleTime: 0 // Always fetch fresh data
  });

  // Filter purchases by status (paid/credit)
  const allPurchases = purchasesData?.data || [];
  const filteredPurchases = allPurchases.filter((purchase: any) => {
    if (statusFilter === 'all') return true;
    
    const totalAmount = purchase.totalAmount || 0;
    const amountPaid = purchase.amountPaid || 0;
    
    // Check if there are payments and calculate from payment history
    let finalBalance = totalAmount - amountPaid;
    
    // If payments exist, use the last payment's balance
    if (purchase.payments && purchase.payments.length > 0) {
      const lastPayment = purchase.payments[purchase.payments.length - 1];
      finalBalance = lastPayment.balance || 0;
    }
    
    const isPaid = finalBalance <= 0.01; // Allow for small rounding differences
    
    if (statusFilter === 'paid') return isPaid;
    if (statusFilter === 'credit') return !isPaid;
    
    return true;
  });

  // Apply pagination to filtered results
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const purchases = filteredPurchases.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage) || 1;
  const totalCount = filteredPurchases.length;
  


  // Calculate summary statistics - use analytics if available, otherwise use purchase totals
  const allPurchaseData = purchasesData?.data || [];
  const purchaseTotalAmount = allPurchaseData.reduce((sum: number, purchase: Purchase) => sum + (purchase.totalAmount || 0), 0);
  const purchaseTotalPaid = allPurchaseData.reduce((sum: number, purchase: Purchase) => sum + (purchase.amountPaid || 0), 0);
  
  // Use analytics data if available, otherwise fall back to calculated purchase data
  const totalAmount = analyticsData?.totalpurchases ?? purchaseTotalAmount;
  const totalPaid = analyticsData?.paid ?? purchaseTotalPaid;
  const totalOutstanding = analyticsData?.credit ?? (purchaseTotalAmount - purchaseTotalPaid);

  const handleDownloadStatement = () => {
    try {
      console.log('Starting PDF download...');
      
      // Use the already fetched data to generate the PDF
      const statementPurchases = purchasesData?.data || [];
      console.log('Statement purchases data:', statementPurchases);
      console.log('Total amount:', totalAmount);
      console.log('Total outstanding:', totalOutstanding);
      
      const doc = new jsPDF();
      
      // Professional Header
      // Company/Shop name
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(adminData?.primaryShop?.name || 'Business Name', 20, 20);
      
      // Document title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('SUPPLIER STATEMENT', 20, 30);
      
      // Add horizontal line
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);
      
      // Supplier information section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('SUPPLIER DETAILS', 20, 50);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${supplierName || 'Supplier'}`, 20, 60);
      doc.text(`Statement Period: ${dateFrom || new Date().toISOString().split('T')[0]} to ${dateTo || new Date().toISOString().split('T')[0]}`, 20, 68);
      
      // Statement info (right side)
      doc.text(`Statement Date: ${new Date().toLocaleDateString()}`, 120, 60);
      doc.text(`Currency: ${shopCurrency}`, 120, 68);
      doc.text(`Total Orders: ${statementPurchases.length}`, 120, 76);
      
      // Financial Summary section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('FINANCIAL SUMMARY', 20, 85);
      
      // Add summary box background
      doc.setFillColor(245, 245, 245);
      doc.rect(20, 90, 170, 25, 'F');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Amount: ${shopCurrency} ${(totalAmount || 0).toFixed(2)}`, 25, 100);
      doc.text(`Amount Paid: ${shopCurrency} ${(totalPaid || 0).toFixed(2)}`, 25, 108);
      
      doc.setFont('helvetica', 'bold');
      doc.text(`Outstanding Balance: ${shopCurrency} ${(totalOutstanding || 0).toFixed(2)}`, 120, 100);
      doc.text(`Status: ${(totalOutstanding || 0) > 0 ? 'PENDING PAYMENT' : 'FULLY PAID'}`, 120, 108);
      
      // Table data
      if (statementPurchases.length > 0) {
        console.log('Processing table data...');
        const tableData = statementPurchases.map((purchase: any) => {
          const purchaseTotal = purchase.totalAmount || 0;
          const amountPaid = purchase.amountPaid || 0;
          let finalBalance = purchaseTotal - amountPaid;
          
          // Use last payment balance if available
          if (purchase.payments && purchase.payments.length > 0) {
            const lastPayment = purchase.payments[purchase.payments.length - 1];
            finalBalance = lastPayment.balance || 0;
          }
          
          const isPaid = finalBalance <= 0.01;
          
          return [
            purchase.purchaseNo || '',
            new Date(purchase.createdAt).toLocaleDateString(),
            `${shopCurrency} ${purchaseTotal.toFixed(2)}`,
            `${shopCurrency} ${amountPaid.toFixed(2)}`,
            `${shopCurrency} ${finalBalance.toFixed(2)}`,
            isPaid ? 'Paid' : 'Credit'
          ];
        });
        
        console.log('Table data prepared:', tableData);
        
        // Check if autoTable is available
        if (typeof (doc as any).autoTable === 'function') {
          (doc as any).autoTable({
            head: [['Purchase No', 'Date', 'Total Amount', 'Amount Paid', 'Outstanding', 'Status']],
            body: tableData,
            startY: 115,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [66, 139, 202] },
            columnStyles: {
              2: { halign: 'right' },
              3: { halign: 'right' },
              4: { halign: 'right' }
            }
          });
        } else {
          // Fallback to manual table creation
          console.log('autoTable not available, using manual table creation');
          let yPosition = 125;
          
          // Table title
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('PURCHASE TRANSACTIONS', 20, yPosition);
          yPosition += 10;
          
          // Table header background
          doc.setFillColor(66, 139, 202);
          doc.rect(20, yPosition - 5, 170, 10, 'F');
          
          // Table headers
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255); // White text for header
          doc.text('Purchase No', 22, yPosition + 2);
          doc.text('Date', 62, yPosition + 2);
          doc.text('Total Amount', 102, yPosition + 2);
          doc.text('Amount Paid', 132, yPosition + 2);
          doc.text('Outstanding', 162, yPosition + 2);
          doc.text('Status', 192, yPosition + 2);
          
          yPosition += 15;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0); // Black text for data rows
          
          // Table rows
          tableData.forEach((row: string[]) => {
            if (yPosition > 270) { // Add new page if needed
              doc.addPage();
              yPosition = 20;
            }
            
            doc.text(row[0], 20, yPosition); // Purchase No
            doc.text(row[1], 60, yPosition); // Date
            doc.text(row[2], 100, yPosition); // Total Amount
            doc.text(row[3], 130, yPosition); // Amount Paid
            doc.text(row[4], 160, yPosition); // Outstanding
            doc.text(row[5], 190, yPosition); // Status
            
            yPosition += 8;
          });
          
          // Add Payment History section if there are payments
          const allPayments = statementPurchases.flatMap((purchase: any) => 
            (purchase.payments || []).map((payment: any) => ({
              ...payment,
              purchaseNo: purchase.purchaseNo
            }))
          );
          
          if (allPayments.length > 0) {
            yPosition += 20; // Add some space
            
            if (yPosition > 250) { // Add new page if needed
              doc.addPage();
              yPosition = 20;
            }
            
            // Payment History title
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('PAYMENT HISTORY', 20, yPosition);
            yPosition += 10;
            
            // Payment history header background
            doc.setFillColor(34, 139, 34); // Green background
            doc.rect(20, yPosition - 5, 170, 10, 'F');
            
            // Payment history headers
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255); // White text for header
            doc.text('Receipt No', 22, yPosition + 2);
            doc.text('Purchase No', 62, yPosition + 2);
            doc.text('Date', 102, yPosition + 2);
            doc.text('Amount', 132, yPosition + 2);
            doc.text('Balance', 162, yPosition + 2);
            
            yPosition += 15;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0); // Black text for data rows
            
            // Sort payments by date
            allPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            // Payment history rows
            allPayments.forEach((payment: any) => {
              if (yPosition > 270) { // Add new page if needed
                doc.addPage();
                yPosition = 20;
              }
              
              doc.text(payment.paymentNo || '', 20, yPosition);
              doc.text(payment.purchaseNo || '', 60, yPosition);
              doc.text(new Date(payment.date).toLocaleDateString(), 100, yPosition);
              doc.text(`${shopCurrency} ${payment.amount.toFixed(2)}`, 130, yPosition);
              doc.text(`${shopCurrency} ${payment.balance.toFixed(2)}`, 160, yPosition);
              
              yPosition += 8;
            });
          }
        }
      }
      
      console.log('Saving PDF...');
      const fileName = `${(supplierName || 'Supplier').replace(/[^a-zA-Z0-9]/g, '_')}_Statement.pdf`;
      doc.save(fileName);
      
      console.log('PDF saved successfully');
      toast({
        title: "Success",
        description: "Statement downloaded as PDF successfully",
      });
    } catch (error) {
      console.error('Error downloading statement PDF:', error);
      toast({
        title: "Error",
        description: `Failed to download statement PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const handleDownloadPaymentHistory = (purchaseId: string) => {
    try {
      // Find the purchase in already fetched data
      const paymentPurchases = purchasesData?.data || [];
      const purchase = paymentPurchases.find((p: any) => p._id === purchaseId);
      
      if (!purchase) {
        toast({
          title: "Error",
          description: "Purchase not found",
          variant: "destructive",
        });
        return;
      }

      const totalAmount = purchase.totalAmount || 0;
      const amountPaid = purchase.amountPaid || 0;
      let finalBalance = totalAmount - amountPaid;
      
      // Use last payment balance if available
      if (purchase.payments && purchase.payments.length > 0) {
        const lastPayment = purchase.payments[purchase.payments.length - 1];
        finalBalance = lastPayment.balance || 0;
      }
      
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.text('Payment History Report', 20, 20);
      
      // Purchase details
      doc.setFontSize(12);
      doc.text(`Purchase No: ${purchase.purchaseNo}`, 20, 40);
      doc.text(`Supplier: ${purchase.supplier?.name || 'N/A'}`, 20, 50);
      doc.text(`Total Amount: ${shopCurrency} ${totalAmount.toFixed(2)}`, 20, 60);
      doc.text(`Amount Paid: ${shopCurrency} ${amountPaid.toFixed(2)}`, 20, 70);
      doc.text(`Outstanding Balance: ${shopCurrency} ${finalBalance.toFixed(2)}`, 20, 80);
      doc.text(`Report Generated: ${new Date().toLocaleString()}`, 20, 90);
      
      // Payment history table
      if (purchase.payments && purchase.payments.length > 0) {
        const tableData = purchase.payments.map((payment: any) => [
          payment.paymentNo || `REC${Date.now()}`,
          new Date(payment.date).toLocaleDateString(),
          `${shopCurrency} ${(payment.amount || 0).toFixed(2)}`,
          `${shopCurrency} ${(payment.balance || 0).toFixed(2)}`
        ]);
        
        (doc as any).autoTable({
          head: [['Payment No', 'Date', 'Amount', 'Balance After']],
          body: tableData,
          startY: 105,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [66, 139, 202] },
          columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' }
          }
        });
      }
      
      doc.save(`Purchase_${purchase.purchaseNo}_Payment_History.pdf`);
      
      toast({
        title: "Success",
        description: "Payment history downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download payment history",
        variant: "destructive",
      });
    }
  };

  const viewPaymentHistory = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setIsPaymentHistoryOpen(true);
  };

  if (!supplierId) {
    return (
      <DashboardLayout title="Supplier History">
        <div className="text-center py-8">
          <p className="text-muted-foreground">No supplier selected</p>
          <Button onClick={() => navigate('/suppliers')} className="mt-4">
            Back to Suppliers
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Purchase History - ${supplierName}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => {
              const isAttendantRoute = window.location.pathname.startsWith('/attendant');
              const route = isAttendantRoute ? '/attendant/suppliers' : '/suppliers';
              navigate(route);
            }}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Suppliers
          </Button>
          <Button onClick={handleDownloadStatement} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download Statement
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{totalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">{shopCurrency} {totalAmount.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="text-2xl font-bold">{shopCurrency} {totalPaid.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-2xl font-bold text-red-600">{shopCurrency} {totalOutstanding.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by purchase number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                placeholder="From date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <Input
                type="date"
                placeholder="To date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 per page</SelectItem>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Purchase History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading purchase history...</p>
              </div>
            ) : purchases.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No purchases found</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purchase No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Amount Paid</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((purchase: Purchase) => (
                      <TableRow key={purchase._id}>
                        <TableCell className="font-medium">
                          {purchase.purchaseNo || `P-${purchase._id.slice(-6)}`}
                        </TableCell>
                        <TableCell>
                          {new Date(purchase.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            {purchase.items && purchase.items.length > 0 ? (
                              <div className="space-y-1">
                                {purchase.items.slice(0, 2).map((item, index) => (
                                  <div key={index} className="text-sm">
                                    {item.product?.name || 'Unknown Product'} 
                                    <span className="text-muted-foreground"> x{item.quantity}</span>
                                  </div>
                                ))}
                                {purchase.items.length > 2 && (
                                  <p className="text-xs text-muted-foreground">
                                    +{purchase.items.length - 2} more items
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">No items</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {shopCurrency} {purchase.totalAmount?.toFixed(2) || '0.00'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {shopCurrency} {purchase.amountPaid?.toFixed(2) || '0.00'}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            // Use the outstandingBalance key directly
                            const outstandingBalance = (purchase as any).outstandingBalance || 0;
                            
                            return (
                              <span className={`font-medium ${
                                outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {shopCurrency} {outstandingBalance.toFixed(2)}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            // First check if paymentType is credit
                            if ((purchase as any).paymentType === 'credit') {
                              // Use the outstandingBalance key directly
                              const outstandingBalance = (purchase as any).outstandingBalance || 0;
                              
                              // Credit purchase is "Paid" only if outstanding balance is 0 or negative
                              const isPaid = outstandingBalance <= 0.01;
                              
                              return (
                                <Badge variant={isPaid ? 'default' : 'secondary'}>
                                  {isPaid ? 'Paid' : 'Credit'}
                                </Badge>
                              );
                            } else {
                              // For cash purchases, always show as "Paid"
                              return (
                                <Badge variant="default">
                                  Paid
                                </Badge>
                              );
                            }
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewPaymentHistory(purchase)}
                            >
                              <Receipt className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadPaymentHistory(purchase._id)}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} entries
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment History Dialog */}
        <Dialog open={isPaymentHistoryOpen} onOpenChange={setIsPaymentHistoryOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Payment History - {selectedPurchase?.purchaseNo || `P-${selectedPurchase?._id.slice(-6)}`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedPurchase?.payments && selectedPurchase.payments.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="text-lg font-bold">
                        {selectedPurchase.shopId?.currency || shopCurrency} {selectedPurchase.totalAmount?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                      <p className="text-lg font-bold text-red-600">
                        {selectedPurchase.shopId?.currency || shopCurrency} {((selectedPurchase.totalAmount || 0) - (selectedPurchase.amountPaid || 0)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance After</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPurchase.payments.map((payment, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{payment.paymentNo}</TableCell>
                          <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {selectedPurchase.shopId?.currency || shopCurrency} {payment.amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {selectedPurchase.shopId?.currency || shopCurrency} {payment.balance?.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No payments recorded for this purchase</p>
                </div>
              )}
              
              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => selectedPurchase && handleDownloadPaymentHistory(selectedPurchase._id)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Payment History
                </Button>
                <Button onClick={() => setIsPaymentHistoryOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}