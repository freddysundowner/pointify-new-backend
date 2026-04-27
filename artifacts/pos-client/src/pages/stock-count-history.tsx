import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Search, Download, FileText, Eye, ChevronDown, ChevronUp, ArrowLeft, AlertTriangle, RotateCcw, BarChart3 } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { useAuth } from "@/features/auth/useAuth";
import { useLocation } from "wouter";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCurrency } from "@/utils";

interface StockCountHistory {
  _id: string;
  createdAt: string;
  attendantId: {
    _id: string;
    username: string;
  };
  shopId: string;
  products: Array<{
    productId: string;
    physicalCount: number;
    systemCount: number;
    variance: number;
    productName?: string;
  }>;
  totalVariance: number;
  status: string;
}

export default function StockCountHistoryPage() {
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  
  // Stock analysis dialog state
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = useState(false);
  const [analysisFromDate, setAnalysisFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [analysisToDate, setAnalysisToDate] = useState(new Date().toISOString().split('T')[0]);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  // Get authentication and shop data using proper hooks
  const { attendant } = useAttendantAuth();
  const { admin } = useAuth();
  const { shopId, adminId, attendantId } = usePrimaryShop();
  const [, setLocation] = useLocation();
  
  const currency = useCurrency()

  // Fetch stock count history with proper authentication context
  const { data: historyData, isLoading, error } = useQuery({
    queryKey: [ENDPOINTS.stockCounts.getAll, shopId, adminId, attendantId, fromDate, toDate, currentPage, itemsPerPage],
    queryFn: async () => {
      // Build query parameters
      const params = new URLSearchParams({
        fromDate,
        toDate
      });
      
      // Add attendantId parameter for attendant requests
      if (attendant) {
        params.append('attendantId', attendant._id);
      }
      
      const response = await apiRequest("GET", `${ENDPOINTS.stockCounts.getAll}?${params.toString()}`);
      return await response.json();
    },
    enabled: !!shopId && !!adminId,
    staleTime: 0, // Always consider data stale
    refetchOnMount: 'always' // Always refetch when component mounts
  });

  const stockCounts: StockCountHistory[] = historyData || [];

  // Function to fetch stock analysis data
  const fetchStockAnalysis = async () => {
    if (!shopId) return;
    
    setIsLoadingAnalysis(true);
    try {
      const params = new URLSearchParams({
        fromDate: analysisFromDate,
        toDate: analysisToDate,
        shopId: shopId
      });
      
      const response = await apiRequest("GET", `${ENDPOINTS.stockCounts.countAnalysis}?${params.toString()}`);
      const data = await response.json();
      setAnalysisData(data);
    } catch (error) {
      console.error('Stock analysis error:', error);
      setAnalysisData({ error: 'Failed to fetch stock analysis data' });
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  // Filter stock counts based on search query
  const filteredCounts = stockCounts.filter((count) =>
    count.attendantId?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (count._id || count.id || '').toString().toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination
  const totalItems = filteredCounts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCounts = filteredCounts.slice(startIndex, startIndex + itemsPerPage);



  const handleExport = (format: 'pdf' | 'csv') => {
    if (format === 'pdf') {
      exportToPDF();
    } else {
      console.log(`Exporting stock count history as ${format}`);
    }
  };

  const exportToPDF = () => {
    console.log("Exporting stock count history as pdf");
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Header
    doc.setFontSize(20);
    doc.text('Stock Count History Report', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Period: ${fromDate} to ${toDate}`, pageWidth / 2, 30, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 40, { align: 'center' });
    
    // Add detailed product counts table
    if (filteredCounts && filteredCounts.length > 0) {
      const tableData: any[] = [];
      
      filteredCounts.forEach((count) => {
        const dateTime = `${new Date(count.createdAt).toLocaleDateString()} ${new Date(count.createdAt).toLocaleTimeString()}`;
        const attendant = count.attendantId?.username || 'Unknown';
        
        if (count.products && count.products.length > 0) {
          count.products.forEach((product: any) => {
            const productName = typeof product.productId === 'object' ? product.productId.name : (product.productName || product.productId);
            tableData.push([
              dateTime,
              attendant,
              productName,
              product.initialCount || product.systemCount || 0,
              product.physicalCount || 0,
              `${product.variance > 0 ? '+' : ''}${product.variance || 0}`
            ]);
          });
        } else {
          tableData.push([
            dateTime,
            attendant,
            'No products counted',
            '-',
            '-',
            '0'
          ]);
        }
      });
      
      autoTable(doc, {
        startY: 60,
        head: [['Date & Time', 'Attendant', 'Product', 'System Count', 'Physical Count', 'Variance']],
        body: tableData,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] },
        margin: { left: 15, right: 15 },
        columnStyles: {
          0: { cellWidth: 35 }, // Date & Time
          1: { cellWidth: 25 }, // Attendant
          2: { cellWidth: 40 }, // Product
          3: { cellWidth: 20 }, // System Count
          4: { cellWidth: 25 }, // Physical Count
          5: { cellWidth: 20 }  // Variance
        }
      });
    } else {
      doc.setFontSize(12);
      doc.text('No stock count sessions found for the selected period.', 20, 60);
    }
    
    // Save the PDF
    const fileName = `stock-count-history-${fromDate}-to-${toDate}.pdf`;
    doc.save(fileName);
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-8">
            <div className="text-red-600">Error loading stock count history</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-4">
          {/* Back Button */}
          <div className="flex items-center">
            <Button 
              variant="outline" 
              onClick={() => setLocation(attendant ? "/attendant/dashboard" : "/stock/count")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {attendant ? "Back to Dashboard" : "Back to Stock Count"}
            </Button>
          </div>
          
          {/* Header with Title and Action Buttons */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock Count History</h1>
              <p className="text-gray-600">View and manage past stock count sessions</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsAnalysisDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                View Count Analysis
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleExport('csv')}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Export CSV
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleExport('pdf')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Custom Date Range */}
              <div className="flex gap-2 items-center">
                <Calendar className="h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-40"
                />
                <span className="text-gray-500">to</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-40"
                />
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by attendant or count ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Clear Filters Button */}
              <Button 
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setFromDate(today);
                  setToDate(today);
                  setSearchQuery('');
                }}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>



        {/* History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Stock Count Sessions</CardTitle>
            <CardDescription>
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="text-gray-600">Loading stock count history...</div>
              </div>
            ) : paginatedCounts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-600">No stock count sessions found for the selected period.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium">Date & Time</th>
                      <th className="text-left p-4 font-medium">Attendant</th>
                      <th className="text-left p-4 font-medium">Products</th>
                      <th className="text-left p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCounts.map((count) => (
                      <React.Fragment key={count._id}>
                        <tr 
                          className="border-b hover:bg-gray-50 cursor-pointer"
                          onClick={() => setExpandedSession(expandedSession === count._id ? null : count._id)}
                        >
                          <td className="p-4">
                            <div className="text-sm">
                              <div className="font-medium">
                                {new Date(count.createdAt).toLocaleDateString()}
                              </div>
                              <div className="text-gray-500">
                                {new Date(count.createdAt).toLocaleTimeString()}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm">
                              {count.attendantId?.username || 'Unknown'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm font-medium">
                              {count.products?.length || 0} items
                            </div>
                          </td>
                          <td className="p-4">
                            <Button variant="ghost" size="sm">
                              {expandedSession === count._id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                        
                        {/* Expanded Product Details Row */}
                        {expandedSession === count._id && (
                          <tr className="bg-gray-50">
                            <td colSpan={4} className="p-0">
                              <div className="p-4 border-l-4 border-blue-500">
                                <h4 className="font-medium text-sm mb-3">Individual Product Counts</h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-gray-200">
                                        <th className="text-left py-2 font-medium">Product Name</th>
                                        <th className="text-left py-2 font-medium">System Qty</th>
                                        <th className="text-left py-2 font-medium">Physical Count</th>
                                        <th className="text-left py-2 font-medium">Variance</th>
                                        <th className="text-left py-2 font-medium">Date & Time</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {count.products && count.products.length > 0 ? (
                                        count.products.map((product: any, index: number) => (
                                          <tr key={index} className="border-b border-gray-100">
                                            <td className="py-2">
                                              <div className="font-medium">
                                                {typeof product.productId === 'object' ? product.productId.name : product.productName || product.productId}
                                              </div>
                                            </td>
                                            <td className="py-2">{product.initialCount || 0}</td>
                                            <td className="py-2">{product.physicalCount || 0}</td>
                                            <td className="py-2">
                                              <span className={`font-medium ${
                                                product.variance === 0 ? 'text-green-600' :
                                                product.variance > 0 ? 'text-blue-600' : 'text-red-600'
                                              }`}>
                                                {product.variance > 0 ? '+' : ''}{product.variance || 0}
                                              </span>
                                            </td>
                                            <td className="py-2">
                                              <div className="text-xs text-gray-600">
                                                <div>{new Date(count.createdAt).toLocaleDateString()}</div>
                                                <div>{new Date(count.createdAt).toLocaleTimeString()}</div>
                                              </div>
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td colSpan={5} className="py-4 text-center text-gray-500">
                                            No product details available
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Items per page:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
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
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  
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
            )}
          </CardContent>
        </Card>

        {/* Stock Analysis Dialog */}
        <Dialog open={isAnalysisDialogOpen} onOpenChange={setIsAnalysisDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Stock Count Analysis</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Date Filters */}
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">From Date</label>
                  <Input
                    type="date"
                    value={analysisFromDate}
                    onChange={(e) => setAnalysisFromDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">To Date</label>
                  <Input
                    type="date"
                    value={analysisToDate}
                    onChange={(e) => setAnalysisToDate(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={fetchStockAnalysis}
                  disabled={isLoadingAnalysis}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoadingAnalysis ? "Loading..." : "Get Analysis"}
                </Button>
              </div>

              {/* Analysis Results */}
              <div className="mt-6">
                {isLoadingAnalysis && (
                  <div className="text-center py-8">
                    <div className="text-gray-600">Loading stock analysis...</div>
                  </div>
                )}
                
                {analysisData && !isLoadingAnalysis && (
                  <div className="space-y-4">
                    {analysisData.error ? (
                      <div className="text-red-600 text-center py-4">
                        {analysisData.error}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Recovery Analysis */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Eye className="h-5 w-5 text-green-600" />
                              Stock Recovery
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Total Recovered Quantity:</span>
                              <span className="font-semibold text-green-600">
                                {analysisData.totalRecoveredQty || 0} items
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Total Recovered Value:</span>
                              <span className="font-semibold text-green-600">
                                {currency} {analysisData.totalRecoveredCost || 0}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Loss Analysis */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-red-600" />
                              Stock Loss
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Total Lost Quantity:</span>
                              <span className="font-semibold text-red-600">
                                {analysisData.totalLostQty || 0} items
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Total Lost Value:</span>
                              <span className="font-semibold text-red-600">
                                {currency} {analysisData.totalLostCost || 0}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Summary Card */}
                        <Card className="md:col-span-2">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <BarChart3 className="h-5 w-5 text-blue-600" />
                              Analysis Summary
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center p-4 bg-green-50 rounded-lg">
                                <div className="text-2xl font-bold text-green-600">
                                  {analysisData.totalRecoveredQty || 0}
                                </div>
                                <div className="text-sm text-gray-600">Items Recovered</div>
                              </div>
                              <div className="text-center p-4 bg-red-50 rounded-lg">
                                <div className="text-2xl font-bold text-red-600">
                                  {analysisData.totalLostQty || 0}
                                </div>
                                <div className="text-sm text-gray-600">Items Lost</div>
                              </div>
                              <div className="text-center p-4 bg-green-50 rounded-lg">
                                <div className="text-lg font-bold text-green-600">
                                  {currency} {analysisData.totalRecoveredCost || 0}
                                </div>
                                <div className="text-sm text-gray-600">Value Recovered</div>
                              </div>
                              <div className="text-center p-4 bg-red-50 rounded-lg">
                                <div className="text-lg font-bold text-red-600">
                                  {currency} {analysisData.totalLostCost || 0}
                                </div>
                                <div className="text-sm text-gray-600">Value Lost</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}
                
                {!analysisData && !isLoadingAnalysis && (
                  <div className="text-center py-8 text-gray-500">
                    Select dates and click "Get Analysis" to view stock count analysis
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}