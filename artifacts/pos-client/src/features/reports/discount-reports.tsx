import { useState } from 'react';
import { ArrowLeft, Download, Calendar, ArrowDownRight, TrendingDown, Filter, Users, Tag, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { Link } from 'wouter';

interface DiscountData {
  date: string;
  customer: string;
  discountType: 'bulk' | 'loyalty' | 'promotional' | 'staff';
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  discountPercentage: number;
}

const discountData: DiscountData[] = [
  {
    date: '2025-06-19',
    customer: 'John Doe',
    discountType: 'bulk',
    originalAmount: 5000,
    discountAmount: 500,
    finalAmount: 4500,
    discountPercentage: 10
  },
  {
    date: '2025-06-19',
    customer: 'Jane Smith',
    discountType: 'loyalty',
    originalAmount: 2500,
    discountAmount: 250,
    finalAmount: 2250,
    discountPercentage: 10
  },
  {
    date: '2025-06-18',
    customer: 'Mike Johnson',
    discountType: 'promotional',
    originalAmount: 1800,
    discountAmount: 180,
    finalAmount: 1620,
    discountPercentage: 10
  },
  {
    date: '2025-06-18',
    customer: 'Staff Purchase',
    discountType: 'staff',
    originalAmount: 800,
    discountAmount: 120,
    finalAmount: 680,
    discountPercentage: 15
  },
  {
    date: '2025-06-17',
    customer: 'Sarah Wilson',
    discountType: 'bulk',
    originalAmount: 7500,
    discountAmount: 750,
    finalAmount: 6750,
    discountPercentage: 10
  }
];

export default function DiscountReports() {
  const [dateFilter, setDateFilter] = useState('thisWeek');
  const [discountFilter, setDiscountFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const filteredData = discountData.filter(item => {
    const matchesSearch = item.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.discountType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = discountFilter === 'all' || item.discountType === discountFilter;
    return matchesSearch && matchesFilter;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // Export functions
  const exportToExcel = () => {
    const csvContent = [
      ['Date', 'Customer', 'Type', 'Original Amount', 'Discount Amount', 'Final Amount', 'Discount %'],
      ...filteredData.map(item => [
        item.date,
        item.customer,
        item.discountType,
        item.originalAmount,
        item.discountAmount,
        item.finalAmount,
        item.discountPercentage
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'discount-reports.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const printContent = `
      <html>
        <head>
          <title>Discount Reports</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          <h1>Discount Reports</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Original Amount</th>
                <th>Discount Amount</th>
                <th>Final Amount</th>
                <th>Discount %</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(item => `
                <tr>
                  <td>${item.date}</td>
                  <td>${item.customer}</td>
                  <td>${item.discountType}</td>
                  <td>KES ${item.originalAmount.toLocaleString()}</td>
                  <td>KES ${item.discountAmount.toLocaleString()}</td>
                  <td>KES ${item.finalAmount.toLocaleString()}</td>
                  <td>${item.discountPercentage}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow!.document.write(printContent);
    printWindow!.document.close();
    printWindow!.print();
  };

  const totalDiscounts = discountData.reduce((sum, item) => sum + item.discountAmount, 0);
  const bulkDiscounts = discountData.filter(d => d.discountType === 'bulk').reduce((sum, item) => sum + item.discountAmount, 0);
  const loyaltyDiscounts = discountData.filter(d => d.discountType === 'loyalty').reduce((sum, item) => sum + item.discountAmount, 0);
  const promotionalDiscounts = discountData.filter(d => d.discountType === 'promotional').reduce((sum, item) => sum + item.discountAmount, 0);
  const staffDiscounts = discountData.filter(d => d.discountType === 'staff').reduce((sum, item) => sum + item.discountAmount, 0);

  const getDiscountBadge = (type: string) => {
    const colors = {
      bulk: 'bg-blue-100 text-blue-800',
      loyalty: 'bg-green-100 text-green-800',
      promotional: 'bg-orange-100 text-orange-800',
      staff: 'bg-purple-100 text-purple-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };



  return (
    <DashboardLayout title="Discount Reports">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="sm" className="hidden sm:flex h-8 shrink-0" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/reports")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <ArrowDownRight className="h-5 w-5 text-orange-600 shrink-0" />
                Discount Reports
              </h1>
              <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">Track all discounts given to customers</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-8" onClick={exportToExcel}>
              <Download className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button size="sm" className="h-8" onClick={exportToPDF}>
              <FileText className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Discounts</p>
                  <p className="text-2xl font-bold text-orange-600">KES {totalDiscounts.toLocaleString()}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Bulk Discounts</p>
                <p className="text-xl font-bold text-blue-600">KES {bulkDiscounts.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((bulkDiscounts/totalDiscounts)*100).toFixed(1)}% of total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Loyalty Discounts</p>
                <p className="text-xl font-bold text-green-600">KES {loyaltyDiscounts.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((loyaltyDiscounts/totalDiscounts)*100).toFixed(1)}% of total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Promotional</p>
                <p className="text-xl font-bold text-orange-600">KES {promotionalDiscounts.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((promotionalDiscounts/totalDiscounts)*100).toFixed(1)}% of total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Staff Discounts</p>
                <p className="text-xl font-bold text-purple-600">KES {staffDiscounts.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((staffDiscounts/totalDiscounts)*100).toFixed(1)}% of total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Discounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex gap-2">
                {['all', 'bulk', 'loyalty', 'promotional', 'staff'].map((type) => (
                  <Button 
                    key={type}
                    variant={discountFilter === type ? 'default' : 'outline'} 
                    size="sm"
                    onClick={() => setDiscountFilter(type)}
                    className="capitalize"
                  >
                    {type === 'all' ? 'All Types' : type}
                  </Button>
                ))}
              </div>
              <Input
                placeholder="Search by customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
          </CardContent>
        </Card>

        {/* Detailed Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Discount Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Customer</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-right p-3">Original Amount</th>
                    <th className="text-right p-3">Discount %</th>
                    <th className="text-right p-3">Discount Amount</th>
                    <th className="text-right p-3">Final Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-3">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="p-3 font-medium">{item.customer}</td>
                      <td className="p-3">
                        <Badge className={getDiscountBadge(item.discountType)}>
                          {item.discountType}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">KES {item.originalAmount.toLocaleString()}</td>
                      <td className="p-3 text-right">{item.discountPercentage}%</td>
                      <td className="p-3 text-right text-orange-600 font-bold">KES {item.discountAmount.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold">KES {item.finalAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Show</span>
                <select 
                  value={itemsPerPage} 
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-sm text-gray-600">entries</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} entries
                </span>
                
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                      if (pageNum > totalPages) return null;
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0"
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
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discount Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Discount Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 className="font-semibold text-blue-800 dark:text-blue-200">Most Used Discount</h3>
                <p className="text-blue-600 dark:text-blue-400">Bulk Purchase</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-200">KES {bulkDiscounts.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <h3 className="font-semibold text-orange-800 dark:text-orange-200">Average Discount</h3>
                <p className="text-orange-600 dark:text-orange-400">Per transaction</p>
                <p className="text-lg font-bold text-orange-800 dark:text-orange-200">KES {(totalDiscounts/discountData.length).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <h3 className="font-semibold text-green-800 dark:text-green-200">Customers with Discounts</h3>
                <p className="text-green-600 dark:text-green-400">Unique customers</p>
                <p className="text-lg font-bold text-green-800 dark:text-green-200">{new Set(discountData.map(d => d.customer)).size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}