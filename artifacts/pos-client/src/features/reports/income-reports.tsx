import { useState } from 'react';
import { ArrowLeft, Download, Calendar, DollarSign, TrendingUp, Filter, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { Link } from 'wouter';

interface IncomeData {
  date: string;
  cashSales: number;
  creditSales: number;
  walletPayments: number;
  cardPayments: number;
  total: number;
}

const incomeData: IncomeData[] = [
  {
    date: '2025-06-19',
    cashSales: 8500,
    creditSales: 2200,
    walletPayments: 1800,
    cardPayments: 650,
    total: 13150
  },
  {
    date: '2025-06-18',
    cashSales: 7200,
    creditSales: 1950,
    walletPayments: 1200,
    cardPayments: 800,
    total: 11150
  },
  {
    date: '2025-06-17',
    cashSales: 9800,
    creditSales: 2800,
    walletPayments: 1650,
    cardPayments: 550,
    total: 14800
  },
  {
    date: '2025-06-16',
    cashSales: 4700,
    creditSales: 1800,
    walletPayments: 0,
    cardPayments: 0,
    total: 6500
  }
];

export default function IncomeReports() {
  const [dateFilter, setDateFilter] = useState('thisWeek');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const filteredData = incomeData.filter(item =>
    item.date.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // Export functions
  const exportToExcel = () => {
    const csvContent = [
      ['Date', 'Cash Sales', 'Credit Sales', 'Wallet Payments', 'Card Payments', 'Total'],
      ...filteredData.map(item => [
        item.date,
        item.cashSales,
        item.creditSales,
        item.walletPayments,
        item.cardPayments,
        item.total
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'income-reports.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const printContent = `
      <html>
        <head>
          <title>Income Reports</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          <h1>Income Reports</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Cash Sales</th>
                <th>Credit Sales</th>
                <th>Wallet Payments</th>
                <th>Card Payments</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(item => `
                <tr>
                  <td>${item.date}</td>
                  <td>KES ${item.cashSales.toLocaleString()}</td>
                  <td>KES ${item.creditSales.toLocaleString()}</td>
                  <td>KES ${item.walletPayments.toLocaleString()}</td>
                  <td>KES ${item.cardPayments.toLocaleString()}</td>
                  <td>KES ${item.total.toLocaleString()}</td>
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

  const totalIncome = filteredData.reduce((sum, day) => sum + day.total, 0);
  const totalCash = filteredData.reduce((sum, day) => sum + day.cashSales, 0);
  const totalCredit = filteredData.reduce((sum, day) => sum + day.creditSales, 0);
  const totalWallet = filteredData.reduce((sum, day) => sum + day.walletPayments, 0);
  const totalCard = filteredData.reduce((sum, day) => sum + day.cardPayments, 0);

  return (
    <DashboardLayout title="Income Reports">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/reports")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <DollarSign className="h-8 w-8 text-green-600" />
                Income Reports
              </h1>
              <p className="hidden sm:block text-gray-600 dark:text-gray-400 mt-1">Detailed revenue analysis by payment method</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Report
            </Button>
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button onClick={exportToPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Income</p>
                  <p className="text-2xl font-bold">KES {totalIncome.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Cash Sales</p>
                <p className="text-xl font-bold text-green-600">KES {totalCash.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((totalCash/totalIncome)*100).toFixed(1)}% of total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Credit Sales</p>
                <p className="text-xl font-bold text-blue-600">KES {totalCredit.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((totalCredit/totalIncome)*100).toFixed(1)}% of total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Wallet Payments</p>
                <p className="text-xl font-bold text-purple-600">KES {totalWallet.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((totalWallet/totalIncome)*100).toFixed(1)}% of total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Card Payments</p>
                <p className="text-xl font-bold text-orange-600">KES {totalCard.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((totalCard/totalIncome)*100).toFixed(1)}% of total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="overflow-x-auto no-scrollbar flex gap-2">
                {['today', 'thisWeek', 'thisMonth', 'thisYear'].map((period) => (
                  <Button
                    key={period}
                    variant={dateFilter === period ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDateFilter(period)}
                    className="shrink-0 whitespace-nowrap"
                  >
                    {period === 'thisWeek' ? 'This Week' :
                     period === 'thisMonth' ? 'This Month' :
                     period === 'thisYear' ? 'This Year' : period}
                  </Button>
                ))}
              </div>
              <Input
                placeholder="Search by date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64"
              />
            </div>
          </CardContent>
        </Card>

        {/* Detailed Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Income Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Date</th>
                    <th className="text-right p-3">Cash Sales</th>
                    <th className="text-right p-3">Credit Sales</th>
                    <th className="text-right p-3">Wallet Payments</th>
                    <th className="text-right p-3">Card Payments</th>
                    <th className="text-right p-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((day, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-3 font-medium">{new Date(day.date).toLocaleDateString()}</td>
                      <td className="p-3 text-right text-green-600">KES {day.cashSales.toLocaleString()}</td>
                      <td className="p-3 text-right text-blue-600">KES {day.creditSales.toLocaleString()}</td>
                      <td className="p-3 text-right text-purple-600">KES {day.walletPayments.toLocaleString()}</td>
                      <td className="p-3 text-right text-orange-600">KES {day.cardPayments.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold">KES {day.total.toLocaleString()}</td>
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

        {/* Performance Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <h3 className="font-semibold text-green-800 dark:text-green-200">Best Performing Day</h3>
                <p className="text-green-600 dark:text-green-400">June 17, 2025</p>
                <p className="text-lg font-bold text-green-800 dark:text-green-200">KES 14,800</p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 className="font-semibold text-blue-800 dark:text-blue-200">Average Daily Income</h3>
                <p className="text-blue-600 dark:text-blue-400">Last 7 days</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-200">KES {(totalIncome/incomeData.length).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <h3 className="font-semibold text-purple-800 dark:text-purple-200">Primary Payment Method</h3>
                <p className="text-purple-600 dark:text-purple-400">Cash dominates</p>
                <p className="text-lg font-bold text-purple-800 dark:text-purple-200">{((totalCash/totalIncome)*100).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}