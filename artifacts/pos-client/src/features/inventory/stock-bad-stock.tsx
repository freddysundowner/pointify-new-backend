import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { normalizeIds } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Plus, Search, Trash2, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useShop } from "@/features/shop/useShop";
import { useProducts } from "@/contexts/ProductsContext";
import { usePermissions } from "@/hooks/usePermissions";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { useLocation } from "wouter";

interface BadStockItem {
  _id: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  reportedBy: string;
  reportedAt: string;
  status: "pending" | "reviewed" | "written-off";
  estimatedValue: number;
}

export default function StockBadStock() {
  const { hasPermission, hasAttendantPermission } = usePermissions();
  const { toast } = useToast();
  const { currency, shop } = useShop();
  const { products } = useProducts();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Get authentication and shop data using proper hooks
  const { attendant } = useAttendantAuth();
  const { shopId, adminId, attendantId } = usePrimaryShop();
  const [, setLocation] = useLocation();
  const getAttendantIdValue = (attendantId: any) => {
    return typeof attendantId === "object" && attendantId !== null
      ? attendantId._id
      : attendantId;
  };
  const { data: badStockResponse, isLoading } = useQuery({
    queryKey: ["bad-stock", shopId, adminId, attendantId, currentPage, itemsPerPage, searchQuery, startDate, endDate],
    queryFn: async () => {
      if (!shopId) return { data: [], count: 0, totalPages: 0 };
      try {
        const params = new URLSearchParams({
          shopId,
          page: currentPage.toString(),
          limit: itemsPerPage.toString(),
          ...(attendantId && { attendantId: getAttendantIdValue(attendantId) }),
          ...(searchQuery && { search: searchQuery }),
          ...(startDate && { startDate }),
          ...(endDate && { endDate })
        });
        const response = await apiRequest("GET", `${ENDPOINTS.badStock.getAll}?${params.toString()}`);
        const data = await response.json();
        const items = Array.isArray(data) ? data : data?.data || [];
        return Array.isArray(data) ? 
          { data: normalizeIds(items), count: items.length, totalPages: 1 } : 
          { data: normalizeIds(items), count: data?.count || 0, totalPages: data?.totalPages || 1 };
      } catch (error) {
        console.error("Failed to fetch bad stock:", error);
        return { data: [], count: 0, totalPages: 0 };
      }
    },
    enabled: !!shopId,
  });

  const badStockItems = badStockResponse?.data || [];
  const totalItemsCount = badStockResponse?.count || 0;
  const totalPages = badStockResponse?.totalPages || 1;

  // Fetch summary analytics
  const { data: summaryData } = useQuery({
    queryKey: ["bad-stock-summary", shopId, adminId, attendantId, startDate, endDate],
    queryFn: async () => {
      if (!shopId) return null;
      try {
        const params = new URLSearchParams({
          shopId,
          ...(attendantId && { attendantId: getAttendantIdValue(attendantId) }),
          ...(startDate && { startDate }),
          ...(endDate && { endDate })
        });
        const response = await apiRequest("GET", `${ENDPOINTS.badStock.summaryAnalysis}?${params.toString()}`);
        return await response.json();
      } catch (error) {
        console.error("Failed to fetch bad stock summary:", error);
        return null;
      }
    },
    enabled: !!shopId,
  });

  // Use summary data if available, fallback to calculated values
  const badStockValue = summaryData?.totalValue || badStockItems.reduce((sum: number, item: any) => sum + (item.quantity * (item.unitPrice || 0)), 0);
  const badStockCount = summaryData?.totalCount || badStockItems.length;
  const totalQuantity = summaryData?.totalQuantity || badStockItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

  const createBadStockMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", ENDPOINTS.badStock.create, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Bad stock item reported successfully" });
      queryClient.invalidateQueries({ queryKey: ["bad-stock"] });
      setShowAddForm(false);
      setSelectedProduct("");
      setQuantity("");
      setReason("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to report bad stock", variant: "destructive" });
    }
  });

  const deleteBadStockMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", ENDPOINTS.badStock.delete(id));
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Bad stock item deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["bad-stock"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete bad stock item", variant: "destructive" });
    }
  });

  const handleSubmit = () => {
    if (!selectedProduct || !quantity || !reason) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const selectedProd = products.find(p => p._id === selectedProduct);
    if (!selectedProd) {
      toast({ title: "Error", description: "Selected product not found", variant: "destructive" });
      return;
    }

    createBadStockMutation.mutate({
      productId: selectedProduct,
      shopId,
      attendantId,
      quantity: parseInt(quantity),
      unitPrice: selectedProd.price || selectedProd.sellingPrice || 0,
      reason,
      useWarehouse: true
    });
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending Review</Badge>;
      case "reviewed":
        return <Badge variant="default">Reviewed</Badge>;
      case "written-off":
        return <Badge variant="destructive">Written Off</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Check if user has permission to manage bad stock
  const canManageBadStock = hasPermission('inventory_view') || hasAttendantPermission('stocks', 'badstock');
  if (!canManageBadStock) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => setLocation(attendant ? "/attendant/dashboard" : "/stock/bad-stock")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {attendant ? "Back to Dashboard" : "Back"}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bad Stock Management</h1>
              <p className="text-gray-600">Report and manage damaged or expired inventory</p>
            </div>
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-gray-600">
                You don't have permission to manage bad stock. Contact your administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setLocation(attendant ? "/attendant/dashboard" : "/stock/bad-stock")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {attendant ? "Back to Dashboard" : "Back"}
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bad Stock Management</h1>
            <p className="text-gray-600">Report and manage damaged or expired inventory</p>
          </div>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Bad Stock Value</p>
                  <p className="text-2xl font-bold text-red-600">{currency} {badStockValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Items</p>
                  <p className="text-2xl font-bold">{badStockCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Quantity</p>
                  <p className="text-2xl font-bold">{totalQuantity}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Bad Stock Items</span>
            </CardTitle>
            <CardDescription>
              Track and manage damaged, expired, or unusable inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Date Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-600">From:</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-600">To:</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button variant="outline" onClick={clearFilters}>
                Clear Dates
              </Button>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(parseInt(value))}>
                  <SelectTrigger className="w-24">
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

              <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Report Bad Stock
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Report Bad Stock</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Product</label>
                      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.filter((product: any) => product._id || product.id).map((product: any) => (
                            <SelectItem key={product._id || product.id} value={product._id || product.id}>
                              {product.name} - {currency} {product.price || product.sellingPrice}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Quantity</label>
                      <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Enter quantity"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Reason</label>
                      <Select value={reason} onValueChange={setReason}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="damaged">Damaged</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="defective">Defective</SelectItem>
                          <SelectItem value="missing">Missing</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={handleSubmit} 
                      disabled={createBadStockMutation.isPending}
                      className="w-full"
                    >
                      {createBadStockMutation.isPending ? "Submitting..." : "Submit Report"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : badStockItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No bad stock items found</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Reported By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {badStockItems.map((item: any) => (
                      <TableRow key={item._id}>
                        <TableCell className="font-medium">{item.productName || (typeof item.productId === 'object' ? item.productId?.name || item.productId?._id : item.productId) || 'Unknown Product'}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="capitalize">{item.reason}</TableCell>
                        <TableCell>{item.reportedBy || (typeof item.attendantId === 'object' ? item.attendantId?.username || item.attendantId?._id : item.attendantId) || 'Unknown'}</TableCell>
                        <TableCell>{new Date(item.reportedAt || item.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{currency} {((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteBadStockMutation.mutate(item._id)}
                            disabled={deleteBadStockMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-600">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItemsCount)} of {totalItemsCount} items
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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
      </div>
    </DashboardLayout>
  );
}