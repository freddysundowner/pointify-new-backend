import { useState } from 'react';
import { ArrowLeft, Download, Calendar, Package, AlertTriangle, TrendingUp, Filter, Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { Link } from 'wouter';

interface StockItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unitCost: number;
  totalValue: number;
  status: 'good' | 'low' | 'out' | 'excess';
  lastRestocked: string;
  velocity: 'fast' | 'medium' | 'slow' | 'dead';
}

const stockData: StockItem[] = [
  {
    id: 'PRD001',
    name: 'Rice 25kg',
    category: 'Grains',
    currentStock: 45,
    minStock: 20,
    maxStock: 100,
    unitCost: 2500,
    totalValue: 112500,
    status: 'good',
    lastRestocked: '2025-06-15',
    velocity: 'fast'
  },
  {
    id: 'PRD002',
    name: 'Cooking Oil 5L',
    category: 'Oils',
    currentStock: 8,
    minStock: 15,
    maxStock: 50,
    unitCost: 1200,
    totalValue: 9600,
    status: 'low',
    lastRestocked: '2025-06-10',
    velocity: 'fast'
  },
  {
    id: 'PRD003',
    name: 'Sugar 2kg',
    category: 'Sweeteners',
    currentStock: 0,
    minStock: 10,
    maxStock: 30,
    unitCost: 300,
    totalValue: 0,
    status: 'out',
    lastRestocked: '2025-06-05',
    velocity: 'medium'
  },
  {
    id: 'PRD004',
    name: 'Detergent Powder',
    category: 'Household',
    currentStock: 120,
    minStock: 25,
    maxStock: 80,
    unitCost: 450,
    totalValue: 54000,
    status: 'excess',
    lastRestocked: '2025-06-18',
    velocity: 'slow'
  },
  {
    id: 'PRD005',
    name: 'Vintage Wine',
    category: 'Beverages',
    currentStock: 25,
    minStock: 5,
    maxStock: 30,
    unitCost: 3500,
    totalValue: 87500,
    status: 'good',
    lastRestocked: '2025-05-01',
    velocity: 'dead'
  }
];

export default function StockReport() {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const totalValue = stockData.reduce((sum, item) => sum + item.totalValue, 0);
  const lowStockItems = stockData.filter(item => (item.status === 'low' || item.status === 'out')).length;
  const fastMovingValue = stockData.filter(item => item.velocity === 'fast').reduce((sum, item) => sum + item.totalValue, 0);
  const deadStockValue = stockData.filter(item => item.velocity === 'dead').reduce((sum, item) => sum + item.totalValue, 0);

  const getStatusBadge = (status: string) => {
    const colors = {
      good: 'bg-green-100 text-green-800',
      low: 'bg-yellow-100 text-yellow-800',
      out: 'bg-red-100 text-red-800',
      excess: 'bg-blue-100 text-blue-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getVelocityBadge = (velocity: string) => {
    const colors = {
      fast: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      slow: 'bg-orange-100 text-orange-800',
      dead: 'bg-red-100 text-red-800'
    };
    return colors[velocity as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const filteredData = stockData.filter(item => {
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // Export functions
  const exportToExcel = () => {
    const csvContent = [
      ['Product', 'Category', 'Current Stock', 'Min Stock', 'Max Stock', 'Unit Cost', 'Total Value', 'Status', 'Velocity'],
      ...filteredData.map(item => [
        item.name,
        item.category,
        item.currentStock,
        item.minStock,
        item.maxStock,
        item.unitCost,
        item.totalValue,
        item.status,
        item.velocity
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-report.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const printContent = `
      <html>
        <head>
          <title>Stock Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          <h1>Stock Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Min Stock</th>
                <th>Max Stock</th>
                <th>Unit Cost</th>
                <th>Total Value</th>
                <th>Status</th>
                <th>Velocity</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.category}</td>
                  <td>${item.currentStock}</td>
                  <td>${item.minStock}</td>
                  <td>${item.maxStock}</td>
                  <td>KES ${item.unitCost.toLocaleString()}</td>
                  <td>KES ${item.totalValue.toLocaleString()}</td>
                  <td>${item.status}</td>
                  <td>${item.velocity}</td>
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

  const categories = Array.from(new Set(stockData.map(item => item.category)));

  return (
    <DashboardLayout title="Stock Report">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/reports" className="hidden sm:block">
              <Button variant="outline" size="sm" className="h-8 shrink-0">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Package className="h-5 w-5 text-purple-600 shrink-0" />
                Stock Report
              </h1>
              <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">Comprehensive inventory analysis</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button onClick={exportToExcel} variant="outline" size="sm" className="h-8">
              <Download className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button onClick={exportToPDF} variant="outline" size="sm" className="h-8">
              <FileText className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Stock Value</p>
                  <p className="text-2xl font-bold text-purple-600">KES {totalValue.toLocaleString()}</p>
                </div>
                <Package className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Low Stock Alerts</p>
                  <p className="text-2xl font-bold text-red-600">{lowStockItems}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Fast Moving Items</p>
                <p className="text-xl font-bold text-green-600">KES {fastMovingValue.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((fastMovingValue/totalValue)*100).toFixed(1)}% of total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Dead Stock</p>
                <p className="text-xl font-bold text-red-600">KES {deadStockValue.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((deadStockValue/totalValue)*100).toFixed(1)}% of total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex gap-2">
                <Button 
                  variant={categoryFilter === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setCategoryFilter('all')}
                >
                  All Categories
                </Button>
                {categories.map((category) => (
                  <Button 
                    key={category}
                    variant={categoryFilter === category ? 'default' : 'outline'} 
                    size="sm"
                    onClick={() => setCategoryFilter(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                {['all', 'good', 'low', 'out', 'excess'].map((status) => (
                  <Button 
                    key={status}
                    variant={statusFilter === status ? 'default' : 'outline'} 
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className="capitalize"
                  >
                    {status === 'all' ? 'All Status' : status}
                  </Button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Stock Table */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Product</th>
                    <th className="text-left p-3">Category</th>
                    <th className="text-right p-3">Current Stock</th>
                    <th className="text-right p-3">Min/Max</th>
                    <th className="text-right p-3">Unit Cost</th>
                    <th className="text-right p-3">Total Value</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-center p-3">Velocity</th>
                    <th className="text-left p-3">Last Restocked</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3">{item.category}</td>
                      <td className="p-3 text-right font-bold">{item.currentStock}</td>
                      <td className="p-3 text-right text-sm text-gray-600">{item.minStock}/{item.maxStock}</td>
                      <td className="p-3 text-right">KES {item.unitCost.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold">KES {item.totalValue.toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <Badge className={getStatusBadge(item.status)}>
                          {item.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge className={getVelocityBadge(item.velocity)}>
                          {item.velocity}
                        </Badge>
                      </td>
                      <td className="p-3">{new Date(item.lastRestocked).toLocaleDateString()}</td>
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

        {/* Stock Analysis */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stockData.filter(item => item.status === 'low' || item.status === 'out').map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-200">{item.name}</p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {item.status === 'out' ? 'Out of Stock' : `Low Stock: ${item.currentStock} remaining`}
                      </p>
                    </div>
                    <Badge className="bg-red-100 text-red-800">
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stockData
                  .filter(item => item.velocity === 'fast')
                  .sort((a, b) => b.totalValue - a.totalValue)
                  .slice(0, 3)
                  .map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">{item.name}</p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          Stock: {item.currentStock} units
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-800 dark:text-green-200">KES {item.totalValue.toLocaleString()}</p>
                        <Badge className="bg-green-100 text-green-800">
                          Fast Moving
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}