import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Search, RefreshCw, ArrowLeft, Download, Eye } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { useLocation } from "wouter";
import { useCurrency } from "@/utils";
import { useShopDetails, drawShopHeader } from "@/hooks/useShopDetails";

interface PurchaseReturn {
  _id: string;
  purchaseId: string;
  reason: string;
  totalAmount?: number;
  refundAmount?: number;
  returnDate?: string;
  createdAt?: string;
  purchaseReturnNo?: string;
  attendantId: {
    _id: string;
    username: string;
  };
  shopId: {
    _id: string;
    name: string;
    currency: string;
  };
  items: Array<{
    product: {
      _id: string;
      name: string;
    };
    quantity: number;
    unitPrice: number;
    totalPrice?: number;
  }>;
  status?: string;
}

interface PurchaseReturnsResponse {
  returns: PurchaseReturn[];
  total: number;
}

export default function PurchaseReturns() {
  const { admin } = useAuth();
  const { attendant } = useAttendantAuth();
  const { shopId, adminId, attendantId } = usePrimaryShop();
  const shopDetails = useShopDetails(shopId);
  const [, setLocation] = useLocation();
  const purchasesRoute = useNavigationRoute('purchases');
    const currency = useCurrency()
  
  // Determine back route: attendants go to dashboard, admins go to purchases
  const backRoute = attendant ? '/attendant/dashboard' : purchasesRoute;

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Fetch purchase returns
  const { data: returnsData, isLoading, refetch } = useQuery<PurchaseReturnsResponse>({
    queryKey: [ENDPOINTS.purchaseReturns.getAll, shopId, searchTerm, supplierFilter, startDate, endDate, currentPage, itemsPerPage],
    queryFn: async (): Promise<PurchaseReturnsResponse> => {
      if (!shopId) return { returns: [], total: 0 };

      const params = new URLSearchParams({
        shopId: shopId,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(supplierFilter !== 'all' && { supplierId: supplierFilter }),
        ...(startDate && { fromDate: startDate }),
        ...(endDate && { toDate: endDate }),
        ...(attendant && { attendantId: attendant._id })
      });

      console.log('Fetching fresh purchase returns data from API');
      const responseObj = await apiCall(`${ENDPOINTS.purchaseReturns.getAll}?${params}`);
      const response = await responseObj.json();
      
      // Handle the nested structure: {data: [], meta: {total, page, limit, pages}}
      if (response && response.data && Array.isArray(response.data)) {
        console.log('Nested response with', response.data.length, 'items, total:', response.meta?.total);
        return { 
          returns: response.data, 
          total: response.meta?.total || response.data.length 
        };
      }
      
      // Handle direct array response (fallback)
      if (Array.isArray(response)) {
        console.log('Array response with', response.length, 'items');
        return { returns: response, total: response.length };
      }
      
      console.log('Object response:', response);
      return (response as PurchaseReturnsResponse) || { returns: [], total: 0 };
    },
    enabled: !!shopId,
    staleTime: 0, // Always consider data stale
    refetchOnMount: 'always' // Always refetch when component mounts
  });

  const returns = returnsData?.returns || [];
  const totalReturns = returnsData?.total || 0;
  const totalPages = Math.ceil(totalReturns / itemsPerPage);

  // Fetch suppliers for filter dropdown  
  const { data: suppliersResponse } = useQuery({
    queryKey: [ENDPOINTS.suppliers.getAll, shopId],
    queryFn: async () => {
      if (!shopId) return [];
      const response = await fetch(`${ENDPOINTS.suppliers.getAll}?shopId=${shopId}`, {
        headers: {
          'Authorization': `Bearer ${admin ? localStorage.getItem('authToken') : localStorage.getItem('attendantToken')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch suppliers');
      return response.json();
    },
    enabled: !!shopId
  });
  const suppliers = Array.isArray(suppliersResponse) ? suppliersResponse : [];

  // Summary statistics
  const totalReturnAmount = returns.reduce((sum: number, ret: PurchaseReturn) => sum + (ret.refundAmount || ret.totalAmount || 0), 0);

  const clearFilters = () => {
    setSearchTerm("");
    setSupplierFilter("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const formatCurrency = (amount: number) => {
    return `${currency} ${amount?.toLocaleString() || '0'}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
  };

  const getStatusBadge = (status: string) => {
    const statusColors: { [key: string]: string } = {
      'completed': 'bg-green-100 text-green-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'processing': 'bg-blue-100 text-blue-800',
      'cancelled': 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
        {status || 'Unknown'}
      </Badge>
    );
  };

  const downloadReturnsReport = async () => {
    try {
      // Generate PDF using client-side libraries
      const { jsPDF } = await import('jspdf');
      
      // Calculate totals from current data
      const totalReturnsCount = returns.length;
      const totalAmount = returns.reduce((sum: number, ret: PurchaseReturn) => sum + (ret.refundAmount || ret.totalAmount || 0), 0);
      
      const doc = new jsPDF();
      let yPos = drawShopHeader(doc, shopDetails, "Purchase Returns Report", `Generated on ${new Date().toLocaleDateString()}`);
      
      // Filters applied
      doc.setFontSize(10);
      let filtersText = 'Filters Applied: ';
      if (searchTerm) filtersText += `Search: ${searchTerm} | `;
      if (startDate) filtersText += `From: ${startDate} | `;
      if (endDate) filtersText += `To: ${endDate} | `;
      if (supplierFilter !== 'all') filtersText += `Supplier Filter Applied | `;
      filtersText += `Total Records: ${totalReturnsCount}`;
      
      doc.text(filtersText, 20, yPos);
      yPos += 15;
      
      // Summary
      doc.setFontSize(12);
      doc.text(`Total Returns: ${totalReturnsCount}`, 20, yPos);
      doc.text(`Total Amount: ${currency} ${totalAmount.toLocaleString()}`, 20, yPos + 10);
      yPos += 25;
      
      // Table headers
      doc.setFontSize(10);
      const headers = ['Return #', 'Amount', 'Date', 'Attendant', 'Reason'];
      const colWidths = [40, 30, 30, 40, 50];
      let xPos = 20;
      
      headers.forEach((header, index) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[index];
      });
      
      yPos += 10;
      
      // Table data
      returns.forEach((ret: PurchaseReturn, index: number) => {
        if (yPos > 270) { // New page if needed
          doc.addPage();
          yPos = 20;
        }
        
        xPos = 20;
        const rowData = [
          ret.purchaseReturnNo || ret._id,
          `${currency} ${(ret.refundAmount || ret.totalAmount || 0).toLocaleString()}`,
          new Date(ret.createdAt || ret.returnDate || new Date()).toLocaleDateString(),
          ret.attendantId?.username || 'Unknown',
          ret.reason || 'N/A'
        ];
        
        rowData.forEach((data, colIndex) => {
          const text = String(data);
          if (text.length > 15) {
            doc.text(text.substring(0, 12) + '...', xPos, yPos);
          } else {
            doc.text(text, xPos, yPos);
          }
          xPos += colWidths[colIndex];
        });
        
        yPos += 8;
      });
      
      // Save the PDF
      doc.save(`purchase-returns-${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    }
  };

  return (
    <DashboardLayout title="Purchase Returns">
      <div className="space-y-4">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="h-8"
              onClick={() => setLocation(backRoute)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{attendant ? 'Dashboard' : 'Purchases'}</span>
            </Button>
            <h2 className="text-base font-semibold">Purchase Returns</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={downloadReturnsReport}>
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-gray-500">Total Returns</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold">{totalReturns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-gray-500">Return Amount</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold">{formatCurrency(totalReturnAmount)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">From Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">To Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Search and Other Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search returns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {(suppliers as any[]).map((supplier: any) => (
                    <SelectItem key={supplier._id} value={supplier._id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Returns Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading returns...</span>
              </div>
            ) : returns.length === 0 ? (
              <div className="text-center p-8">
                <p className="text-gray-500">No purchase returns found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Attendant</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returns.map((returnItem: PurchaseReturn) => (
                      <TableRow key={returnItem._id}>
                        <TableCell>
                          {returnItem.purchaseReturnNo || 'N/A'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency((returnItem as any).refundAmount || returnItem.totalAmount || 0)}
                        </TableCell>
                        <TableCell>
                          {formatDate((returnItem as any).createdAt || returnItem.returnDate || new Date().toISOString())}
                        </TableCell>
                        <TableCell>
                          {returnItem.attendantId?.username || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Store return data in window object for the details page
                              (window as any).__returnData = returnItem;
                              
                              // Check if this is an attendant or admin route
                              const currentPath = window.location.pathname;
                              const isAttendantRoute = currentPath.startsWith('/attendant/');
                              
                              if (isAttendantRoute) {
                                setLocation(`/attendant/purchase-return-details/${returnItem._id}`);
                              } else {
                                setLocation(`/purchase-return-details/${returnItem._id}`);
                              }
                            }}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalReturns > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalReturns)} to{' '}
                {Math.min(currentPage * itemsPerPage, totalReturns)} of {totalReturns} returns
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                
                {totalPages > 1 && Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  if (pageNumber <= totalPages) {
                    return (
                      <Button
                        key={pageNumber}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNumber)}
                      >
                        {pageNumber}
                      </Button>
                    );
                  }
                  return null;
                })}
                
                {totalPages === 1 && (
                  <Button variant="default" size="sm" disabled>
                    1
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}