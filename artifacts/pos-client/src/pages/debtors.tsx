import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, DollarSign, Users, AlertTriangle, ChevronLeft, ChevronRight, Download } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useAuth } from "@/features/auth/useAuth";
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { useLocation, Link } from "wouter";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { ENDPOINTS } from "@/lib/api-endpoints";

interface Debtor {
  _id: string;
  name: string;
  email?: string;
  phonenumber?: string;
  wallet: number;
  totalOutstanding: number;
  lastPurchaseDate?: string;
  customerNo?: number;
  type?: string;
  creditLimit?: number;
}

interface DebtorsResponse {
  shopId: string;
  total: number;
  totalDebtors: number;
  totalDebtAmount: number;
  debtors: Debtor[];
  page?: number;
  limit?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export default function DebtorsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const { admin } = useAuth();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const [, navigate] = useLocation();
  const customerOverviewRoute = useNavigationRoute('customerOverview');
  
  // Get primary shop data from admin
  const primaryShop = admin?.primaryShop;
  const shopId = selectedShopId || (typeof primaryShop === 'object' ? primaryShop._id : primaryShop);
  const currency = (typeof primaryShop === 'object' ? primaryShop.currency : undefined) || 'KES';

  // Fetch debtors data
  const { data: debtorsData, isLoading, error, refetch } = useQuery({
    queryKey: [ENDPOINTS.customers.getDebtors, shopId, currentPage, pageSize],
    queryFn: async (): Promise<DebtorsResponse> => {
      if (!shopId || !admin?._id) {
        throw new Error('Shop ID or Admin ID not available');
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`${ENDPOINTS.customers.getDebtors}?shopId=${shopId}&adminid=${admin._id}&page=${currentPage}&limit=${pageSize}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch debtors data');
      }

      return await response.json();
    },
    enabled: !!shopId && !!admin?._id,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  // Filter debtors based on search term
  const filteredDebtors = debtorsData?.debtors?.filter(debtor =>
    debtor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    debtor.phonenumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    debtor.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Helper function to generate customer overview URL
  const getCustomerOverviewUrl = (customerId: string) => {
    return `${customerOverviewRoute}?id=${customerId}`;
  };

  const handleDownloadReport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/customers/customers/debtors/excel?shopId=${shopId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download report');
      }

      // Create blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debtors-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading report:', error);
      // You could add toast notification here
    }
  };

  const formatCurrency = (amount: number) => {
    return `${currency} ${Math.abs(amount).toLocaleString()}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <CardTitle className="text-red-600">Error Loading Debtors</CardTitle>
              <CardDescription>
                Failed to load debtors data. Please try again.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => refetch()} variant="outline">
                Try Again
              </Button>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customer Debtors</h1>
            <p className="text-muted-foreground">
              Track customers with outstanding debt and manage credit accounts
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            Refresh Data
          </Button>
        </div>

        {/* Summary Card */}
        {debtorsData && (
          <div className="flex justify-center">
            <Card className="w-full max-w-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Outstanding Debt</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(debtorsData.total || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total amount owed by all customers
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Debtors List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>
                  Debtors List ({filteredDebtors.length})
                </CardTitle>
                <CardDescription>
                  Customers with outstanding debt requiring attention
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search by name, phone, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  onClick={handleDownloadReport}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Report
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse"></div>
                    </div>
                    <div className="w-20 h-6 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : filteredDebtors.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {searchTerm ? 'No matching debtors found' : 'No debtors found'}
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm 
                    ? 'Try adjusting your search terms to find debtors'
                    : 'All customers are up to date with their payments'
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Customer</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Contact</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Outstanding Debt</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDebtors.map((debtor) => (
                      <tr key={debtor._id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                              <span className="text-red-600 font-semibold">
                                {debtor.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="font-medium">{debtor.name}</div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            {debtor.phonenumber && (
                              <div className="text-sm text-muted-foreground">{debtor.phonenumber}</div>
                            )}
                            {debtor.email && (
                              <div className="text-sm text-muted-foreground">{debtor.email}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="font-semibold text-red-600">
                            {formatCurrency(debtor.totalDebt || 0)}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <Badge variant="destructive" className="text-xs">
                              Debt
                            </Badge>
                            <Link href={getCustomerOverviewUrl(debtor._id)}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 hover:text-blue-700"
                                onClick={() => {
                                  // Pass customer data to customer overview page
                                  (window as any).__customerData = {
                                    _id: debtor._id,
                                    name: debtor.name,
                                    email: debtor.email,
                                    phonenumber: debtor.phonenumber,
                                    wallet: debtor.wallet,
                                    totalOutstanding: debtor.totalDebt || 0,
                                    customerType: debtor.type || 'Regular'
                                  };
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Pay Debt
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {debtorsData && debtorsData.debtors.length > 0 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, debtorsData.totalDebtors)} of {debtorsData.totalDebtors} debtors
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, Math.ceil(debtorsData.totalDebtors / pageSize)) }, (_, i) => {
                      const totalPages = Math.ceil(debtorsData.totalDebtors / pageSize);
                      let pageNumber;
                      
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage > totalPages - 3) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNumber}
                          variant={currentPage === pageNumber ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNumber)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNumber}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(Math.ceil(debtorsData.totalDebtors / pageSize), currentPage + 1))}
                    disabled={currentPage >= Math.ceil(debtorsData.totalDebtors / pageSize)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}