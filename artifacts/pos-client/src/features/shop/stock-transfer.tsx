import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Trash2, Plus, Package, ArrowRight, Eye, Download, ArrowLeft } from 'lucide-react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { apiCall } from '@/lib/api-config';
import { apiRequest } from '@/lib/queryClient';
import { ENDPOINTS } from '@/lib/api-endpoints';
import { useToast } from '@/hooks/use-toast';
import { useProducts } from '@/contexts/ProductsContext';
import { usePrimaryShop } from '@/hooks/usePrimaryShop';
import { useAttendantAuth } from '@/contexts/AttendantAuthContext';
import { useLocation } from 'wouter';
import type { Product as SharedProduct } from '@shared/schema';

interface StockTransfer {
  _id: string;
  productId: string;
  productName: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  status: "pending" | "in-transit" | "completed" | "cancelled";
  requestedBy: string;
  requestedAt: string;
  completedAt?: string;
  notes?: string;
}



interface Shop {
  _id: string;
  name: string;
  address?: string;
  location?: {
    type: string;
    coordinates: number[];
  };
}

interface TransferProduct {
  product: string;
  quantity: number;
  productName?: string;
}

export default function StockTransfer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<TransferProduct[]>([]);
  const [formData, setFormData] = useState({
    fromShopId: undefined as string | undefined,
    toShopId: undefined as string | undefined,
    notes: ""
  });

  // Date filter state
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  
  // Product search state
  const [productSearch, setProductSearch] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Get authentication data
  const { attendant } = useAttendantAuth();
  const { shopId, adminId, userType, attendantId } = usePrimaryShop();
  const [, setLocation] = useLocation();

  const { data: transfers = [], isLoading } = useQuery<StockTransfer[]>({
    queryKey: ["stock-transfers"],
    queryFn: async () => {
      try {
        const response = await apiCall(ENDPOINTS.transfers.filter, {
          method: "GET",
        });
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        return [];
      }
    },
  });

  // Fetch all shops for this admin
  const { data: shopsResponse = [] } = useQuery({
    queryKey: ["shops", adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const response = await apiCall(ENDPOINTS.shop.getAll, {
        method: "GET",
      });
      return response;
    },
    enabled: !!adminId,
  });

  // Fetch products for the selected source shop - no fallback
  const { data: products = [], isLoading: isLoadingProducts, error: productsError } = useQuery({
    queryKey: [`shop-products`, formData.fromShopId],
    queryFn: async () => {
      if (!formData.fromShopId || !adminId) return [];
      
      console.log('Fetching products for shop:', formData.fromShopId);
      
      try {
        const token = userType === 'attendant' ? localStorage.getItem('attendantToken') : localStorage.getItem('authToken');
        const response = await fetch(`${ENDPOINTS.products.getByShop(formData.fromShopId)}?attendantId=${attendantId || adminId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.error(`API response error: ${response.status}`);
          // Return empty array for any API errors to show "no products available"
          return [];
        }
        
        const data = await response.json();
        console.log('Shop products response:', data);
        const shopProducts = Array.isArray(data) ? data : (data?.data || []);
        console.log(`Shop ${formData.fromShopId} has ${shopProducts.length} products`);
        
        return shopProducts;
      } catch (error) {
        console.error('Network error fetching products:', error);
        // Return empty array on network errors
        return [];
      }
    },
    enabled: !!formData.fromShopId && !!adminId,
    retry: false, // Don't retry on errors
  });
  
  // Filter products based on search and exclude already selected products
  const filteredProducts = products.filter((product: any) => 
    !selectedProducts.find(p => p.product === product._id) &&
    (product.name || '').toLowerCase().includes(productSearch.toLowerCase())
  );
  
  const shops: Shop[] = (() => {
    if (Array.isArray(shopsResponse)) return shopsResponse;
    if (shopsResponse && typeof shopsResponse === 'object' && 'data' in shopsResponse && Array.isArray(shopsResponse.data)) {
      return shopsResponse.data;
    }
    return [];
  })();



  // Fetch transfer history
  const { data: transferHistoryResponse = { data: [], pagination: { total: 0, totalPages: 0 } }, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["transfer-history", shops.map(shop => shop._id).join(','), dateFilter.startDate, dateFilter.endDate, currentPage, itemsPerPage],
    queryFn: async () => {
      const shopIds = shops.map(shop => shop._id);
      
      // Create URL with shops array as repeated query parameters
      const params = new URLSearchParams();
      
      // Add pagination parameters
      params.append('limit', itemsPerPage.toString());
      params.append('page', currentPage.toString());
      
      // Add date filters if provided
      if (dateFilter.startDate) params.append('startDate', dateFilter.startDate);
      if (dateFilter.endDate) params.append('endDate', dateFilter.endDate);
      
      // Add attendantId if user is attendant
      if (userType === 'attendant' && attendantId) {
        params.append('attendantId', attendantId);
      }
      
      // Add each shop ID as separate 'shops' parameter to create array
      shopIds.forEach(shopId => {
        params.append('shops', shopId);
      });
      
      const url = `${ENDPOINTS.transfers.filter}?${params.toString()}`;
      
      const token = userType === 'attendant' ? localStorage.getItem('attendantToken') : localStorage.getItem('authToken');
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch transfer history: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    },
    enabled: shops.length > 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Extract transfer history data and pagination info
  const transferHistory = Array.isArray(transferHistoryResponse) ? transferHistoryResponse : (transferHistoryResponse?.data || []);
  const pagination = transferHistoryResponse?.pagination || { total: 0, totalPages: 0 };

  // Handle pagination change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle items per page change
  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Toggle row expansion for product details
  const toggleRowExpansion = (transferId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(transferId)) {
      newExpanded.delete(transferId);
    } else {
      newExpanded.add(transferId);
    }
    setExpandedRows(newExpanded);
  };

  // Handle source shop change - clear selected products and search
  const handleSourceShopChange = (shopId: string) => {
    setFormData({...formData, fromShopId: shopId});
    setSelectedProducts([]);
    setProductSearch(''); // Clear search when changing shops
  };

  // Add product to transfer
  const addProduct = (product: SharedProduct) => {
    const existingProduct = selectedProducts.find(p => p.product === product._id);
    if (existingProduct) {
      setSelectedProducts(selectedProducts.map(p => 
        p.product === product._id 
          ? {...p, quantity: p.quantity + 1}
          : p
      ));
    } else {
      const productId = product._id || product.id?.toString();
      const productName = product.name || product.title;
      
      if (productId && productName) {
        setSelectedProducts([...selectedProducts, {
          product: productId,
          quantity: 1,
          productName: productName
        }]);
      }
    }
  };

  // Remove product from transfer
  const removeProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.product !== productId));
  };

  // Update product quantity
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeProduct(productId);
      return;
    }
    setSelectedProducts(selectedProducts.map(p => 
      p.product === productId ? {...p, quantity} : p
    ));
  };

  // Create transfer mutation
  const transferMutation = useMutation({
    mutationFn: async (transferData: any) => {
      const response = await apiRequest('POST', ENDPOINTS.transfers.shopTransfer, transferData);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transfer failed: ${response.status} - ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transfer Created",
        description: "Product transfer has been successfully created",
      });
      queryClient.invalidateQueries({ queryKey: ["transfer-history"] });
      setShowCreateForm(false);
      setSelectedProducts([]);
      setFormData({ fromShopId: undefined, toShopId: undefined, notes: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to create product transfer",
        variant: "destructive",
      });
    },
  });

  // Handle create transfer
  const handleCreateTransfer = () => {
    if (!formData.fromShopId || !formData.toShopId || selectedProducts.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select source shop, destination shop, and at least one product",
        variant: "destructive",
      });
      return;
    }

    const transferData = {
      fromShopId: formData.fromShopId,
      toShopId: formData.toShopId,
      items: selectedProducts.map(p => ({
        productId: p.product,
        quantity: p.quantity
      }))
    };

    transferMutation.mutate(transferData);
  };

  const filteredTransfers = transfers.filter((transfer: StockTransfer) => {
    return true; // No additional filtering for now
  });

  const downloadTransferReport = async () => {
    const reportDate = new Date().toLocaleDateString();
    const dateRange = dateFilter.startDate && dateFilter.endDate 
      ? `${dateFilter.startDate} to ${dateFilter.endDate}`
      : dateFilter.startDate 
        ? `From ${dateFilter.startDate}`
        : dateFilter.endDate
          ? `Until ${dateFilter.endDate}`
          : 'All Dates';

    // Generate transfer rows for the report - each product as separate row
    const transferRows = Array.isArray(transferHistory) 
      ? transferHistory.flatMap(transfer => {
          if (!transfer.productId || transfer.productId.length === 0) {
            return `
              <tr>
                <td>No products</td>
                <td>0</td>
                <td>${transfer.fromShopId?.name || 'Unknown Shop'}<br><small>${transfer.fromShopId?.address || ''}</small></td>
                <td>${transfer.toShopId?.name || 'Unknown Shop'}<br><small>${transfer.toShopId?.address || ''}</small></td>
                <td>${transfer.attendantId?.username || 'Unknown'}</td>
                <td>${new Date(transfer.createdAt).toLocaleDateString()}<br><small>${new Date(transfer.createdAt).toLocaleTimeString()}</small></td>
                <td><span style="background: #4ade80; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">Completed</span></td>
              </tr>
            `;
          }
          
          return transfer.productId.map((product: any) => `
            <tr>
              <td>${product.productName || 'Unknown Product'}</td>
              <td>${product.quantity || 0}</td>
              <td>${transfer.fromShopId?.name || 'Unknown Shop'}<br><small>${transfer.fromShopId?.address || ''}</small></td>
              <td>${transfer.toShopId?.name || 'Unknown Shop'}<br><small>${transfer.toShopId?.address || ''}</small></td>
              <td>${transfer.attendantId?.username || 'Unknown'}</td>
              <td>${new Date(transfer.createdAt).toLocaleDateString()}<br><small>${new Date(transfer.createdAt).toLocaleTimeString()}</small></td>
              <td><span style="background: #4ade80; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">Completed</span></td>
            </tr>
          `).join('');
        }).join('')
      : '<tr><td colspan="7" style="text-align: center; padding: 20px;">No transfers available</td></tr>';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Transfer Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { margin: 0; color: #333; font-size: 24px; }
          .header p { margin: 5px 0; color: #666; }
          .summary { margin-bottom: 20px; background: #e8f4f8; padding: 15px; border-radius: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f8f9fa; font-weight: bold; color: #333; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Shop Transfer Report</h1>
          <p>Generated on: ${reportDate}</p>
          <p>Report Period: ${dateRange}</p>
        </div>

        <div class="summary">
          <h3>Report Summary</h3>
          <p><strong>Total Transfers:</strong> ${Array.isArray(transferHistory) ? transferHistory.length : 0}</p>
          <p><strong>Date Range:</strong> ${dateRange}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Quantity</th>
              <th>From Shop</th>
              <th>To Shop</th>
              <th>Done By</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${transferRows}
          </tbody>
        </table>

        <div class="footer">
          <p>This report was generated automatically from the inventory management system.</p>
          <p>For questions about this report, please contact your system administrator.</p>
        </div>
      </body>
      </html>
    `;

    // Import required libraries dynamically
    const jsPDF = (await import('jspdf')).jsPDF;
    const autoTable = (await import('jspdf-autotable')).default;
    
    // Create new PDF document
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Shop Transfer Report', 20, 20);
    
    // Add report details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${reportDate}`, 20, 35);
    doc.text(`Report Period: ${dateRange}`, 20, 45);
    doc.text(`Total Transfers: ${Array.isArray(transferHistory) ? transferHistory.length : 0}`, 20, 55);
    
    // Prepare table data
    const tableData: any[] = [];
    
    if (Array.isArray(transferHistory)) {
      transferHistory.forEach(transfer => {
        if (transfer.productId && transfer.productId.length > 0) {
          transfer.productId.forEach((item: any) => {
            tableData.push([
              item.product?.name || item.productName || 'Product',
              item.quantity || 0,
              transfer.fromShopId?.name || 'Unknown Shop',
              transfer.toShopId?.name || 'Unknown Shop',
              transfer.attendantId?.username || 'Unknown',
              new Date(transfer.createdAt).toLocaleDateString()
            ]);
          });
        }
      });
    }
    
    // Add table
    autoTable(doc, {
      head: [['Product Name', 'Quantity', 'From Shop', 'To Shop', 'Done By', 'Date']],
      body: tableData,
      startY: 70,
      styles: { 
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: { 
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { top: 70 }
    });
    
    // Save the PDF
    doc.save(`transfer-report-${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF Downloaded",
      description: "Transfer report has been downloaded as PDF file.",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {userType === 'attendant' && (
              <Button
                variant="outline"
                onClick={() => setLocation('/attendant/dashboard')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            )}
            <h1 className="text-3xl font-bold tracking-tight">Stock Transfer</h1>
          </div>
          <Button onClick={() => setShowCreateForm(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 mr-2" />
            New Transfer
          </Button>
        </div>



        {/* Create Transfer Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Transfer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Shop Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Source Shop</label>
                    <Select value={formData.fromShopId} onValueChange={handleSourceShopChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source shop" />
                      </SelectTrigger>
                      <SelectContent>
                        {shops.map((shop) => (
                          <SelectItem key={shop._id} value={shop._id}>
                            {shop.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Destination Shop</label>
                    <Select 
                      value={formData.toShopId} 
                      onValueChange={(value) => setFormData({...formData, toShopId: value})}
                      disabled={!formData.fromShopId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination shop" />
                      </SelectTrigger>
                      <SelectContent>
                        {shops
                          .filter(shop => shop._id !== formData.fromShopId)
                          .map((shop) => (
                            <SelectItem key={shop._id} value={shop._id}>
                              {shop.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Product Selection - Searchable Dropdown */}
                {formData.fromShopId && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Add Products ({isLoadingProducts ? 'Loading...' : `${filteredProducts.length} available`})
                    </label>
                    
                    {/* Search Input */}
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        type="text"
                        placeholder="Search products..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Product Dropdown - Only show if we have data from API */}
                    {productSearch && (
                      <>
                        {isLoadingProducts && (
                          <div className="p-3 text-sm text-gray-500 text-center border rounded-md mb-3">
                            Loading products...
                          </div>
                        )}
                        
                        {!isLoadingProducts && products.length > 0 && filteredProducts.length > 0 && (
                          <div className="border rounded-md bg-white shadow-lg max-h-48 overflow-y-auto mb-3">
                            {filteredProducts.slice(0, 10).map((product: SharedProduct) => (
                              <div 
                                key={product._id} 
                                className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                                onClick={() => {
                                  addProduct(product);
                                  setProductSearch('');
                                }}
                              >
                                <div>
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-sm text-gray-500">Stock: {(product as any).quantity || (product as any).stock || 0}</div>
                                </div>
                                <Button size="sm" variant="outline">
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            {filteredProducts.length > 10 && (
                              <div className="p-3 text-sm text-gray-500 text-center border-t">
                                Showing first 10 results. Keep typing to narrow down...
                              </div>
                            )}
                          </div>
                        )}

                        {!isLoadingProducts && products.length > 0 && filteredProducts.length === 0 && (
                          <div className="p-3 text-sm text-gray-500 text-center border rounded-md mb-3">
                            No products found matching "{productSearch}"
                          </div>
                        )}

                        {!isLoadingProducts && products.length === 0 && (
                          <div className="p-3 text-sm text-gray-500 text-center border rounded-md mb-3">
                            {productsError ? 'Unable to load products (API timeout)' : 'No products available for this shop'}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Selected Products */}
                {selectedProducts.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Selected Products</label>
                    <div className="space-y-2">
                      {selectedProducts.map((item) => (
                        <div key={item.product} className="flex items-center justify-between p-3 border rounded-md">
                          <div className="flex-1">
                            <div className="font-medium">{item.productName}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product, parseInt(e.target.value) || 1)}
                              className="w-20 px-2 py-1 border rounded text-center"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeProduct(item.product)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Transfer Notes</label>
                  <Textarea 
                    placeholder="Optional transfer notes or special instructions" 
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleCreateTransfer} 
                    disabled={transferMutation.isPending || selectedProducts.length === 0 || !formData.fromShopId || !formData.toShopId}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {transferMutation.isPending ? "Processing..." : "Transfer Products"}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setShowCreateForm(false);
                    setSelectedProducts([]);
                    setFormData({ fromShopId: undefined, toShopId: undefined, notes: "" });
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Date Filter Controls */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold">Transfer History</CardTitle>
              <Button 
                variant="outline" 
                onClick={downloadTransferReport}
                disabled={isLoadingHistory || transferHistory.length === 0}
                className="flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Download PDF</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Start Date</label>
                <input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => setDateFilter({...dateFilter, startDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => setDateFilter({...dateFilter, endDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => setDateFilter({ startDate: '', endDate: '' })}
                  className="mb-0"
                >
                  Clear Dates
                </Button>
              </div>
            </div>

            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left p-4 font-medium">Items</th>
                      <th className="text-left p-4 font-medium">From</th>
                      <th className="text-left p-4 font-medium">To</th>
                      <th className="text-left p-4 font-medium">Done By</th>
                      <th className="text-left p-4 font-medium">Date</th>
                      <th className="text-left p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingHistory ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-gray-500">
                          Loading transfers...
                        </td>
                      </tr>
                    ) : transferHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-gray-500">
                          No transfer records found
                        </td>
                      </tr>
                    ) : (
                      transferHistory.map((transfer: any) => (
                        <React.Fragment key={transfer._id}>
                          <tr 
                            className="border-b hover:bg-gray-50 cursor-pointer" 
                            onClick={() => toggleRowExpansion(transfer._id)}
                          >
                            <td className="p-4">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">
                                  {transfer.productId?.length || 0} items
                                </span>
                                <span className="text-xs text-gray-500">
                                  {expandedRows.has(transfer._id) ? '▼' : '▶'}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div>
                                <div className="font-medium text-sm">{transfer.fromShopId?.name || 'Unknown'}</div>
                                <div className="text-xs text-gray-500">{transfer.fromShopId?.address}</div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div>
                                <div className="font-medium text-sm">{transfer.toShopId?.name || 'Unknown'}</div>
                                <div className="text-xs text-gray-500">{transfer.toShopId?.address}</div>
                              </div>
                            </td>
                            <td className="p-4">{transfer.attendantId?.username || 'Unknown'}</td>
                            <td className="p-4">{new Date(transfer.createdAt).toLocaleDateString()}</td>
                            <td className="p-4">
                              <div className="flex items-center space-x-2">
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {expandedRows.has(transfer._id) && (
                            <tr className="bg-gray-50">
                              <td colSpan={6} className="p-4">
                                <div className="bg-white rounded-md p-4 border">
                                  <h4 className="font-medium text-sm mb-3">Transfer Items:</h4>
                                  <div className="space-y-2">
                                    {transfer.productId?.map((item: any, index: number) => (
                                      <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                                        <div>
                                          <span className="font-medium text-sm">
                                            {item.product?.name || 'Product'}
                                          </span>
                                          {item.product?.measure && (
                                            <span className="text-xs text-gray-500 ml-2">
                                              ({item.product.measure})
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-sm">
                                          <span className="font-medium">Qty: {item.quantity}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              <div className="flex items-center justify-between p-4 border-t">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Items per page:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={(value) => handleItemsPerPageChange(Number(value))}>
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
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Showing {Math.min((currentPage - 1) * itemsPerPage + 1, transferHistory.length)} to {Math.min(currentPage * itemsPerPage, transferHistory.length)} of {pagination.total || transferHistory.length} transfers
                  </span>
                  
                  <div className="flex space-x-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                    >
                      Previous
                    </Button>
                    
                    {Array.from({ length: Math.min(5, pagination.totalPages || Math.ceil(transferHistory.length / itemsPerPage)) }, (_, i) => {
                      const page = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                      const totalPages = pagination.totalPages || Math.ceil(transferHistory.length / itemsPerPage);
                      
                      if (page > totalPages) return null;
                      
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= (pagination.totalPages || Math.ceil(transferHistory.length / itemsPerPage))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}