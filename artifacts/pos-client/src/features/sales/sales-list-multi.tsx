import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { TrendingUp, DollarSign, ShoppingCart, Users, Filter, Calendar, ChevronLeft, ChevronRight, Search, ChevronDown, ChevronUp, Edit, Trash2, RotateCcw, Receipt, MoreHorizontal } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useNavigationRoute } from "@/lib/navigation-utils";
import type { Sale, SaleItem } from "@shared/schema";

// Dummy sales data with multi-item support - replace with your external API data
const mockSales: Sale[] = [
  {
    id: 1,
    customerName: "John Smith",
    items: [
      { productName: "Premium Widget", quantity: 2, unitPrice: 149.99, totalPrice: 299.98 },
      { productName: "Extended Warranty", quantity: 1, unitPrice: 49.99, totalPrice: 49.99 }
    ],
    totalAmount: 349.97,
    saleDate: "2024-06-18",
    status: "cash"
  },
  {
    id: 2,
    customerName: "Sarah Johnson",
    items: [
      { productName: "Basic Package", quantity: 1, unitPrice: 149.50, totalPrice: 149.50 }
    ],
    totalAmount: 149.50,
    saleDate: "2024-06-17",
    status: "completed"
  },
  {
    id: 3,
    customerName: "Mike Wilson",
    items: [
      { productName: "Pro Service", quantity: 1, unitPrice: 599.00, totalPrice: 599.00 }
    ],
    totalAmount: 599.00,
    saleDate: "2024-06-17",
    status: "hold"
  },
  {
    id: 4,
    customerName: "Emily Davis",
    items: [
      { productName: "Starter Kit", quantity: 3, unitPrice: 29.99, totalPrice: 89.97 },
      { productName: "Add-on Pack", quantity: 2, unitPrice: 19.99, totalPrice: 39.98 }
    ],
    totalAmount: 129.95,
    saleDate: "2024-06-16",
    status: "credit"
  },
  {
    id: 5,
    customerName: "David Brown",
    items: [
      { productName: "Advanced Solution", quantity: 1, unitPrice: 799.00, totalPrice: 799.00 }
    ],
    totalAmount: 799.00,
    saleDate: "2024-06-16",
    status: "returned"
  },
  {
    id: 6,
    customerName: "Lisa Anderson",
    items: [
      { productName: "Standard Package", quantity: 2, unitPrice: 99.99, totalPrice: 199.98 },
      { productName: "Setup Fee", quantity: 1, unitPrice: 25.00, totalPrice: 25.00 }
    ],
    totalAmount: 224.98,
    saleDate: "2024-06-15",
    status: "completed"
  },
  {
    id: 7,
    customerName: "Robert Taylor",
    items: [
      { productName: "Enterprise Solution", quantity: 1, unitPrice: 1199.99, totalPrice: 1199.99 },
      { productName: "Installation", quantity: 1, unitPrice: 100.00, totalPrice: 100.00 }
    ],
    totalAmount: 1299.99,
    saleDate: "2024-06-15",
    status: "hold"
  },
  {
    id: 8,
    customerName: "Jennifer White",
    items: [
      { productName: "Basic Service", quantity: 4, unitPrice: 19.99, totalPrice: 79.96 }
    ],
    totalAmount: 79.96,
    saleDate: "2024-06-14",
    status: "completed"
  },
  {
    id: 9,
    customerName: "Michael Garcia",
    items: [
      { productName: "Premium Service", quantity: 1, unitPrice: 299.99, totalPrice: 299.99 },
      { productName: "Express Delivery", quantity: 1, unitPrice: 15.00, totalPrice: 15.00 },
      { productName: "Gift Wrapping", quantity: 1, unitPrice: 5.99, totalPrice: 5.99 }
    ],
    totalAmount: 320.98,
    saleDate: "2024-06-14",
    status: "completed"
  },
  {
    id: 10,
    customerName: "Amanda Martinez",
    items: [
      { productName: "Custom Package", quantity: 2, unitPrice: 274.99, totalPrice: 549.98 }
    ],
    totalAmount: 549.98,
    saleDate: "2024-06-13",
    status: "returned"
  }
];

// Calculate summary stats
const totalRevenue = mockSales
  .filter(sale => sale.status === "completed")
  .reduce((sum, sale) => sum + sale.totalAmount, 0);

const totalSales = mockSales.filter(sale => sale.status === "completed").length;
const totalQuantity = mockSales
  .filter(sale => sale.status === "completed")
  .reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
const uniqueCustomers = new Set(mockSales.map(sale => sale.customerName)).size;

export default function SalesListMulti() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [, setLocation] = useLocation();
  const salesRoute = useNavigationRoute('sales');

  // Filter sales based on selected status, date range, and search query
  const filteredSales = mockSales.filter(sale => {
    // Status filter
    const statusMatch = statusFilter === "all" || sale.status === statusFilter;
    
    // Date filter
    let dateMatch = true;
    if (startDate || endDate) {
      const saleDate = new Date(sale.saleDate);
      if (startDate) {
        const start = new Date(startDate);
        dateMatch = dateMatch && saleDate >= start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the entire end date
        dateMatch = dateMatch && saleDate <= end;
      }
    }
    
    // Search filter (product names, customer name, or receipt ID)
    let searchMatch = true;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      searchMatch = 
        sale.items.some(item => item.productName.toLowerCase().includes(query)) ||
        sale.customerName.toLowerCase().includes(query) ||
        sale.id.toString().includes(query);
    }
    
    return statusMatch && dateMatch && searchMatch;
  });

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

  // Pagination calculations
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredSales.slice(startIndex, endIndex);
  }, [filteredSales, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

  // Reset to first page when filters change
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const toggleRowExpansion = (saleId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(saleId)) {
      newExpanded.delete(saleId);
    } else {
      newExpanded.add(saleId);
    }
    setExpandedRows(newExpanded);
  };

  // Action handlers
  const handleViewReceipt = (sale: Sale) => {
    setLocation(`/receipt/${sale.id}`);
  };

  const handleEditSale = (sale: Sale) => {
    setLocation(`${salesRoute}/edit/${sale.id}`);
  };

  const handleReturnSale = (sale: Sale) => {
    setLocation(`${salesRoute}/return/${sale.id}`);
  };

  const handleDeleteSale = (sale: Sale) => {
    setLocation(`${salesRoute}/delete/${sale.id}`);
  };

  // Calculate filtered stats
  const filteredRevenue = filteredSales
    .filter(sale => sale.status === "completed")
    .reduce((sum, sale) => sum + sale.totalAmount, 0);

  const filteredSalesCount = filteredSales.filter(sale => sale.status === "completed").length;
  const filteredQuantity = filteredSales
    .filter(sale => sale.status === "completed")
    .reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  const filteredCustomers = new Set(filteredSales.map(sale => sale.customerName)).size;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "hold":
        return "secondary";
      case "returned":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getItemsSummary = (items: SaleItem[]) => {
    if (items.length === 1) {
      return items[0].productName;
    }
    return `${items.length} items (${items.map(item => item.productName).join(", ")})`;
  };

  return (
    <DashboardLayout title="Sales Dashboard">
      <div className="p-4">
        <div className="w-full">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Sales Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monitor your sales performance and revenue metrics
            </p>
          </div>

          {/* Filters Section */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4" />
                <span className="font-medium">Filters</span>
              </div>
              
              <div className="space-y-4">
                {/* Search */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Search</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search by product, customer, or receipt ID..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-10 h-9"
                      />
                    </div>
                    {searchQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSearchChange("")}
                        className="h-9 px-3"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  {searchQuery && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Found {filteredSales.length} results for "{searchQuery}"
                    </p>
                  )}
                </div>

                {/* Status Filters */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Status</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={statusFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusFilter("all")}
                    >
                      All ({mockSales.length})
                    </Button>
                    <Button
                      variant={statusFilter === "completed" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusFilter("completed")}
                    >
                      Completed ({mockSales.filter(s => s.status === "completed").length})
                    </Button>
                    <Button
                      variant={statusFilter === "hold" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusFilter("hold")}
                    >
                      Hold ({mockSales.filter(s => s.status === "hold").length})
                    </Button>
                    <Button
                      variant={statusFilter === "returned" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusFilter("returned")}
                    >
                      Returned ({mockSales.filter(s => s.status === "returned").length})
                    </Button>
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Date Range</Label>
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Date Inputs */}
                    <div className="flex flex-col sm:flex-row gap-3 flex-1">
                      <div className="flex-1">
                        <Label htmlFor="start-date" className="text-xs text-muted-foreground mb-1 block">
                          Start Date
                        </Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          placeholder="dd/mm/yyyy"
                          className="h-9"
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="end-date" className="text-xs text-muted-foreground mb-1 block">
                          End Date
                        </Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          placeholder="dd/mm/yyyy"
                          className="h-9"
                        />
                      </div>
                    </div>
                    
                    {/* Quick Date Buttons */}
                    <div className="flex flex-wrap gap-2 items-end">
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
                      Showing {filteredSales.length} results from {startDate || "beginning"} to {endDate || "now"}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Revenue</p>
                  <p className="text-xl font-bold">${filteredRevenue.toFixed(2)}</p>
                </div>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Sales</p>
                  <p className="text-xl font-bold">{filteredSalesCount}</p>
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Items</p>
                  <p className="text-xl font-bold">{filteredQuantity}</p>
                </div>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Customers</p>
                  <p className="text-xl font-bold">{filteredCustomers}</p>
                </div>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </Card>
          </div>

          {/* Sales History Table */}
          <Card className="flex-1">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <CardTitle className="text-lg">
                  Sales History 
                  {statusFilter !== "all" && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      - {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm">
                  <Label htmlFor="items-per-page" className="whitespace-nowrap">
                    Show:
                  </Label>
                  <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                    <SelectTrigger className="w-16 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-sm w-16">Details</th>
                      <th className="text-left py-2 px-3 font-medium text-sm">Receipt ID</th>
                      <th className="text-left py-2 px-3 font-medium text-sm">Customer</th>
                      <th className="text-left py-2 px-3 font-medium text-sm">Items</th>
                      <th className="text-left py-2 px-3 font-medium text-sm">Total</th>
                      <th className="text-left py-2 px-3 font-medium text-sm">Date</th>
                      <th className="text-left py-2 px-3 font-medium text-sm">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-sm w-16">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((sale) => (
                      <>
                        <tr key={sale.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-3 cursor-pointer" onClick={() => toggleRowExpansion(sale.id)}>
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                              {expandedRows.has(sale.id) ? "Hide" : "Show"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-sm font-mono">#{sale.id}</td>
                          <td className="py-2 px-3 text-sm">{sale.customerName}</td>
                          <td className="py-2 px-3 text-sm">
                            {sale.items.length === 1 
                              ? sale.items[0].productName 
                              : `${sale.items.length} items`
                            }
                          </td>
                          <td className="py-2 px-3 text-sm font-medium">${sale.totalAmount.toFixed(2)}</td>
                          <td className="py-2 px-3 text-sm">{new Date(sale.saleDate).toLocaleDateString()}</td>
                          <td className="py-2 px-3">
                            <Badge variant={getStatusBadgeVariant(sale.status)} className="text-xs">
                              {sale.status}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewReceipt(sale)}>
                                  <Receipt className="mr-2 h-4 w-4" />
                                  View Receipt
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleEditSale(sale)}
                                  disabled={sale.status === "returned"}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Sale
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleReturnSale(sale)}
                                  disabled={sale.status === "returned" || sale.status === "hold"}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Process Return
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteSale(sale)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Sale
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                        {expandedRows.has(sale.id) && (
                          <tr className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500">
                            <td colSpan={8} className="py-4 px-6">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Item Breakdown</h4>
                                </div>
                                <div className="grid gap-2">
                                  {sale.items.map((item, index) => (
                                    <div key={index} className="flex justify-between items-center text-sm bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                      <div className="flex flex-col">
                                        <span className="font-medium">{item.productName}</span>
                                        <span className="text-xs text-muted-foreground">
                                          ${item.unitPrice.toFixed(2)} per unit
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-medium">${item.totalPrice.toFixed(2)}</div>
                                        <div className="text-xs text-muted-foreground">Qty: {item.quantity}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t-2 border-gray-200 dark:border-gray-700">
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">Transaction Total:</span>
                                  <span className="font-bold text-lg text-green-600 dark:text-green-400">${sale.totalAmount.toFixed(2)}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
                {filteredSales.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No sales found for the selected filters.
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {filteredSales.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 pt-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    {((currentPage - 1) * itemsPerPage) + 1} to{' '}
                    {Math.min(currentPage * itemsPerPage, filteredSales.length)} of{' '}
                    {filteredSales.length}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0 text-xs"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-2"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}