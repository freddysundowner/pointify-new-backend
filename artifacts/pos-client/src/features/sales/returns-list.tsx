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
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { apiRequest } from "@/lib/queryClient";

function ReturnsList() {
  const { hasPermission, user } = usePermissions();
  const { admin } = useAuth();
  const { shopId, shopData } = usePrimaryShop();
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

  const primaryShopCurrency = (shopData as any)?.currency || 'KES';

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
  const totalCount = (returnsResponse as any)?.meta?.total || 0;
  const apiTotalPages = (returnsResponse as any)?.meta?.totalPages || 1;
  const currentApiPage = (returnsResponse as any)?.meta?.page || 1;

  // Transform API data to match expected format
  const transformedReturns = returnsData.map((returnItem: any) => ({
    id: returnItem.id || returnItem._id,
    receiptNo: (() => {
      const rn: string = returnItem.returnNo || returnItem.saleReturnNo || "";
      if (!rn) return `RET-${String(returnItem.id || 0).padStart(5, "0")}`;
      // Old format: RET{13-digit timestamp} → reformat using row id
      if (/^RET\d{10,}$/.test(rn)) return `RET-${String(returnItem.id || 0).padStart(5, "0")}`;
      return rn;
    })(),
    customerName: returnItem.customer?.name || returnItem.customerId?.name || 'Walk-in',
    totalAmount: returnItem.refundAmount || 0,
    returnDate: returnItem.createdAt,
    status: 'completed',
    paymentTag: returnItem.refundMethod || 'cash',
    saleType: 'Retail',
    items: returnItem.saleReturnItems || returnItem.items || [],
    attendantName: returnItem.processedBy?.username || returnItem.attendantId?.username || 'Unknown',
    attendantId: returnItem.processedBy?.id || returnItem.attendantId?._id || returnItem.processedBy,
    shopId: returnItem.shop || returnItem.shopId,
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
      <div className="p-3 space-y-3">
        <div className="w-full">

          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-gray-500" />
              <h1 className="text-base font-bold text-gray-900 dark:text-white">Sales Returns</h1>
              <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">
                {!startDate && !endDate
                  ? `Today`
                  : startDate === endDate
                  ? new Date(startDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : `${new Date(startDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(endDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                }
              </span>
            </div>
            <PermissionGuard permission="returns_create">
              <Button size="sm" className="h-8 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> New Return
              </Button>
            </PermissionGuard>
          </div>

          {/* Compact Filters */}
          <Card className="mb-3">
            <CardContent className="p-3">
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Attendant */}
                <Select value={attendantFilter} onValueChange={handleAttendantFilter}>
                  <SelectTrigger className="h-8 text-xs w-full sm:w-40">
                    <SelectValue placeholder="All Attendants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Attendants</SelectItem>
                    {uniqueAttendants.map((attendant: any) => {
                      const id = String(attendant.id ?? attendant._id ?? '');
                      return (
                        <SelectItem key={id} value={id}>
                          {attendant.username}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {/* Date pickers */}
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <span className="text-xs text-gray-400 shrink-0">–</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                </div>

                {/* Quick range buttons */}
                <div className="flex items-center gap-1 flex-wrap">
                  {[{ label: "7d", days: 7 }, { label: "30d", days: 30 }, { label: "90d", days: 90 }].map(({ label, days }) => (
                    <Button key={days} variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setDateRange(days)}>
                      {label}
                    </Button>
                  ))}
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 px-2 text-xs text-gray-400"
                    onClick={clearDateFilters}
                    disabled={!startDate && !endDate}
                  >
                    <Calendar className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats — compact inline bar */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Returns</p>
                  <p className="text-lg font-bold">{primaryShopCurrency} {totalReturnsAmount.toFixed(2)}</p>
                </div>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Returns Count</p>
                  <p className="text-lg font-bold">{totalCount}</p>
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>

          {/* Returns History Table */}
          <Card className="flex-1">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  Returns History
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="ml-2 text-xs">{statusFilter}</Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Show:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                    <SelectTrigger className="w-14 h-7 text-xs">
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
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Receipt #</th>
                            <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Customer</th>
                            <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Amount</th>
                            <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Date</th>
                            <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Attendant</th>
                            <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Status</th>
                            <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transformedReturns.map((returnItem: any) => (
                            <tr key={returnItem.id} className="border-b hover:bg-muted/50">
                              <td className="px-3 py-2">
                                <div className="font-medium text-xs">{returnItem.receiptNo}</div>
                              </td>
                              <td className="px-3 py-2 text-xs">{returnItem.customerName}</td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-xs">
                                  {getReturnCurrency(returnItem)} {parseFloat(returnItem.totalAmount).toFixed(2)}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="text-xs">{new Date(returnItem.returnDate).toLocaleDateString()}</div>
                                <div className="text-xs text-muted-foreground">{new Date(returnItem.returnDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="text-xs">{returnItem.attendantName}</div>
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant={getStatusBadgeVariant(returnItem.status)} className="text-xs px-1.5 py-0">
                                  {returnItem.status}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">
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
                  <div className="lg:hidden p-2 space-y-2">
                    {transformedReturns.map((returnItem: any) => (
                      <div key={returnItem.id} className="border rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{returnItem.receiptNo}</div>
                          <div className="text-xs text-muted-foreground truncate">{returnItem.customerName} · {returnItem.attendantName}</div>
                          <div className="text-xs text-muted-foreground">{new Date(returnItem.returnDate).toLocaleDateString()}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-semibold">{getReturnCurrency(returnItem)} {parseFloat(returnItem.totalAmount).toFixed(2)}</div>
                            <Badge variant={getStatusBadgeVariant(returnItem.status)} className="text-xs px-1.5 py-0">{returnItem.status}</Badge>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <PermissionGuard permission="returns_delete">
                                <DropdownMenuItem onClick={() => handleDeleteReturn(returnItem)} className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </PermissionGuard>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
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