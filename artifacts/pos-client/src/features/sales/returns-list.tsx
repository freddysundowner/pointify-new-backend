import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, DollarSign, ShoppingCart, Users, Filter, Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Edit, Trash2, RefreshCw, Eye, MoreHorizontal, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { PermissionGuard } from "@/components/PermissionGuard";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/features/auth/useAuth";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { apiRequest } from "@/lib/queryClient";

function ReturnsList() {
  const { hasPermission, user } = usePermissions();
  const { admin } = useAuth();
  const [location, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  const [dateFilter, setDateFilter] = useState<string>("today");
  const [reportType, setReportType] = useState<string>("all");
  const [attendantFilter, setAttendantFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [returnToDelete, setReturnToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  // Get shop and admin details
  const primaryShop = typeof admin?.primaryShop === 'object' ? admin.primaryShop : null;
  const shopId = (primaryShop as any)?._id;
  const attendantId = admin?._id;
  const primaryShopCurrency = (primaryShop as any)?.currency || 'KES';

  // Function to get currency for a return - extract from shopId object
  const getReturnCurrency = (returnItem: any) => {
    // Extract currency from shopId object if it exists
    if (returnItem.shopId && typeof returnItem.shopId === 'object' && returnItem.shopId.currency) {
      return returnItem.shopId.currency;
    }
    // Fallback to primary shop currency
    return primaryShopCurrency;
  };

  // Build query parameters for returns filter
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (shopId) params.append('shopId', shopId);
    params.append('type', 'returns');
    params.append('paginated', 'true'); // Enable pagination
    
    // Only add status filter if not 'all' and map frontend values to API values
    if (statusFilter !== 'all') {
      if (statusFilter === 'cash') {
        // For cash filter, use both status and paymentTag
        params.append('status', 'cashed');
        params.append('paymentTag', 'cash');
      } else if (statusFilter === 'mpesa') {
        params.append('status', 'cashed');
        params.append('paymentTag', 'mpesa');
      } else if (statusFilter === 'credit') {
        params.append('status', 'cashed');
        params.append('paymentTag', 'credit');
      } else if (statusFilter === 'wallet') {
        params.append('status', 'cashed');
        params.append('paymentTag', 'wallet');
      } else if (statusFilter === 'bank') {
        params.append('status', 'cashed');
        params.append('paymentTag', 'bank');
      } else {
        let apiStatus = statusFilter;
        if (statusFilter === 'completed') apiStatus = 'cashed';
        params.append('status', apiStatus);
      }
    }
    // Default to today's data if no date filter is set
    const today = new Date().toISOString().split('T')[0];
    if (startDate) {
      params.append('fromDate', startDate);
    } else {
      params.append('fromDate', today);
    }
    if (endDate) {
      params.append('toDate', endDate);
    } else {
      params.append('toDate', today);
    }

    if (attendantFilter !== 'all') params.append('attendantId', attendantFilter);
    params.append('page', currentPage.toString());
    params.append('limit', itemsPerPage.toString());
    
    return params.toString();
  };

  // Fetch returns data from API using default query function
  const { data: returnsResponse, isLoading, error, refetch } = useQuery({
    queryKey: [`${ENDPOINTS.saleReturns.getFiltered}?${buildQueryParams()}`],
    enabled: !!shopId
  });

  // No analytics endpoint needed - we'll calculate from the actual returns data

  // Fetch attendants from API
  const { data: attendantsResponse } = useQuery({
    queryKey: [`${ENDPOINTS.attendants.getByShop}?shopId=${shopId}`],
    enabled: !!shopId
  });

  const uniqueAttendants = (attendantsResponse as any)?.data || [];

  const clearDateFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  const setDateRange = (days: number) => {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days);
    
    setStartDate(startDate.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Refresh data when returning to the page
  useEffect(() => {
    const handleFocus = () => {
      if (location === '/returns') {
        refetch();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [location, refetch]);

  // Refresh data when navigating to returns page
  useEffect(() => {
    if (location === '/returns') {
      refetch();
    }
  }, [location, refetch]);

  // API now returns paginated structure with data and pagination metadata
  const returnsData = (returnsResponse as any)?.data || [];
  const totalCount = (returnsResponse as any)?.pagination?.total || 0;
  const apiTotalPages = (returnsResponse as any)?.pagination?.totalPages || 1;
  const currentApiPage = (returnsResponse as any)?.pagination?.page || 1;

  // Transform API data to match expected format
  const transformedReturns = returnsData.map((returnItem: any) => ({
    id: returnItem._id,
    receiptNo: returnItem.saleReturnNo || returnItem._id,
    customerName: returnItem.customerId?.name || 'Walk-in',
    totalAmount: returnItem.refundAmount || 0,
    returnDate: returnItem.createdAt,
    status: 'completed', // Returns are always completed
    paymentTag: 'cash', // Default payment tag
    saleType: 'Retail',
    items: returnItem.items || [],
    attendantName: returnItem.attendantId?.username || 'Unknown',
    attendantId: returnItem.attendantId?._id || returnItem.attendantId,
    shopId: returnItem.shopId,
    reason: returnItem.reason || 'Return processed'
  }));

  // Calculate totals from actual returns data
  const totalReturnsAmount = transformedReturns.reduce((sum: number, returnItem: any) => 
    sum + parseFloat(returnItem.totalAmount || 0), 0
  );



  // Reset to first page when filters change and refresh API data
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };



  const handleAttendantFilter = (attendantId: string) => {
    setAttendantFilter(attendantId);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  // Delete return handler
  const handleDeleteReturn = (returnItem: any) => {
    setReturnToDelete(returnItem);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteReturn = async () => {
    if (!returnToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await apiRequest('DELETE', ENDPOINTS.saleReturns.delete(returnToDelete.id));

      // Refresh the returns list after successful deletion
      refetch();
      
      toast({
        title: "Return Deleted",
        description: `Return ${returnToDelete.receiptNo} has been successfully deleted.`,
      });
    } catch (error) {
      console.error('Error deleting return:', error);
      toast({
        title: "Delete Failed",
        description: 'Failed to delete return. Please try again.',
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setReturnToDelete(null);
    }
  };

  // Status counts for filter buttons
  const getStatusCount = (status: string) => {
    return transformedReturns.filter((returnItem: any) => 
      status === 'all' ? true : returnItem.status === status
    ).length;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "cash":
        return "default";
      case "credit":
        return "secondary";
      case "wallet":
        return "outline";
      case "hold":
        return "secondary";
      case "pending":
        return "outline";
      case "cancelled":
        return "destructive";
      case "returned":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <DashboardLayout title="Sales Returns">
      <div className="p-4">
        <div className="w-full">
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Sales Returns
              </h1>
              <div className="text-gray-600 dark:text-gray-400 mt-1">
                <p>Shop One - Logged in as: {(admin?.attendantId as any)?.username || user?.name} ({user?.role})</p>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {!startDate && !endDate ? 
                    `Showing today's returns (${new Date().toLocaleDateString()})` : 
                    startDate === endDate ? 
                      `Showing returns for ${new Date(startDate).toLocaleDateString()}` :
                      `Showing returns from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`
                  }
                </p>
              </div>
            </div>
            
            {/* Action Buttons - Permission Controlled */}
            <div className="flex gap-2">
              <PermissionGuard permission="returns_create">
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New Return
                </Button>
              </PermissionGuard>
            </div>
          </div>

          {/* Filters Section */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4" />
                <span className="font-medium">Filters</span>
              </div>
              
              <div className="space-y-4">

                {/* Attendant Filter */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Filter by Attendant</Label>
                  <Select value={attendantFilter} onValueChange={handleAttendantFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select attendant..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Attendants</SelectItem>
                      {uniqueAttendants.map((attendant: any) => (
                        <SelectItem key={attendant._id} value={attendant._id}>
                          {attendant.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {attendantFilter !== 'all' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Filtering by: {uniqueAttendants.find((a: any) => a._id === attendantFilter)?.username}
                    </p>
                  )}
                </div>

                {/* Date Range */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Date Range</Label>
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Date Inputs */}
                    <div className="flex flex-col sm:flex-row gap-3 flex-1">
                      <div className="flex-1">
                        <Label htmlFor="start-date" className="text-xs text-muted-foreground mb-1 block">
                          From Date
                        </Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="end-date" className="text-xs text-muted-foreground mb-1 block">
                          To Date
                        </Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    
                    {/* Quick Date Filters */}
                    <div className="flex flex-wrap gap-2 lg:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange(7)}
                        className="h-9"
                      >
                        Last 7 Days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange(30)}
                        className="h-9"
                      >
                        Last 30 Days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange(90)}
                        className="h-9"
                      >
                        Last 90 Days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearDateFilters}
                        disabled={!startDate && !endDate}
                        className="flex items-center gap-1 h-9"
                      >
                        <Calendar className="h-3 w-3" />
                        Clear Dates
                      </Button>
                    </div>
                  </div>
                  
                  {(startDate || endDate) && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing {transformedReturns.length} results from {startDate || "beginning"} to {endDate || "now"}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="space-y-4 mb-4">
            {/* Date Range Header */}
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Summary Stats</h2>
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                {!startDate && !endDate ? 
                  `Today (${new Date().toLocaleDateString()})` : 
                  startDate === endDate ? 
                    `${new Date(startDate).toLocaleDateString()}` :
                    `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
                }
              </span>
            </div>
            
            {/* Summary Metrics - Only Total Returns and Returns Count */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Returns</p>
                    <p className="text-2xl font-bold">{primaryShopCurrency} {totalReturnsAmount.toFixed(2)}</p>
                  </div>
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Returns Count</p>
                    <p className="text-2xl font-bold">{totalCount}</p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>
            </div>

          </div>

          {/* Returns History Table */}
          <Card className="flex-1">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <CardTitle className="text-lg">
                  Returns History 
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {statusFilter}
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">
                      Show:
                    </Label>
                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                      <SelectTrigger className="w-16 h-8">
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
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-muted-foreground">Loading returns...</div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-red-500">Error loading returns</div>
                </div>
              ) : transformedReturns.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-muted-foreground">No returns found</div>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden lg:block">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-4 font-medium">Receipt #</th>
                            <th className="text-left p-4 font-medium">Customer</th>
                            <th className="text-left p-4 font-medium">Amount</th>
                            <th className="text-left p-4 font-medium">Date</th>
                            <th className="text-left p-4 font-medium">Attendant</th>
                            <th className="text-left p-4 font-medium">Status</th>
                            <th className="text-left p-4 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transformedReturns.map((returnItem: any) => (
                            <tr key={returnItem.id} className="border-b hover:bg-muted/50">
                              <td className="p-4">
                                <div className="font-medium">{returnItem.receiptNo}</div>
                              </td>
                              <td className="p-4">{returnItem.customerName}</td>
                              <td className="p-4">
                                <div className="font-medium">
                                  {getReturnCurrency(returnItem)} {parseFloat(returnItem.totalAmount).toFixed(2)}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="text-sm">
                                  {new Date(returnItem.returnDate).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(returnItem.returnDate).toLocaleTimeString()}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="text-sm">{returnItem.attendantName}</div>
                              </td>
                              <td className="p-4">
                                <Badge variant={getStatusBadgeVariant(returnItem.status)}>
                                  {returnItem.status}
                                </Badge>
                              </td>
                              <td className="p-4">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <PermissionGuard permission="returns_delete">
                                      <DropdownMenuItem 
                                        onClick={() => handleDeleteReturn(returnItem)}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                      </DropdownMenuItem>
                                    </PermissionGuard>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile Cards */}
                  <div className="lg:hidden p-4 space-y-4">
                    {transformedReturns.map((returnItem: any) => (
                      <Card key={returnItem.id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium">{returnItem.receiptNo}</div>
                            <div className="text-sm text-muted-foreground">{returnItem.customerName}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{getReturnCurrency(returnItem)} {parseFloat(returnItem.totalAmount).toFixed(2)}</div>
                            <Badge variant={getStatusBadgeVariant(returnItem.status)} className="text-xs">
                              {returnItem.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <div>{new Date(returnItem.returnDate).toLocaleDateString()}</div>
                          <div>{returnItem.attendantName}</div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <PermissionGuard permission="returns_delete">
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteReturn(returnItem)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </PermissionGuard>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Pagination */}
                  {apiTotalPages > 1 && (
                    <div className="border-t px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} results
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          <div className="flex items-center gap-1">
                            <span className="text-sm">Page {currentPage} of {apiTotalPages}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage === apiTotalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Return</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete return {returnToDelete?.receiptNo}? This action cannot be undone and will permanently remove this return from your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteReturn}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Return"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardLayout>
  );
}

export default ReturnsList;