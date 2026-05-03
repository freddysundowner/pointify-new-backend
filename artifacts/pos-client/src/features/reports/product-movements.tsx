import { useState } from 'react';
import { ArrowLeft, Download, Calendar, TrendingUp, ArrowUpRight, ArrowDownRight, RotateCcw, Filter, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { Link } from 'wouter';

interface MovementData {
  id: string;
  date: string;
  product: string;
  type: 'sale' | 'purchase' | 'return' | 'transfer' | 'adjustment';
  quantity: number;
  direction: 'in' | 'out';
  reference: string;
  performedBy: string;
  notes?: string;
}

const movementData: MovementData[] = [
  {
    id: 'MOV001',
    date: '2025-06-19',
    product: 'Rice 25kg',
    type: 'sale',
    quantity: 12,
    direction: 'out',
    reference: 'SALE-2025-001',
    performedBy: 'John Cashier'
  },
  {
    id: 'MOV002',
    date: '2025-06-19',
    product: 'Cooking Oil 5L',
    type: 'purchase',
    quantity: 24,
    direction: 'in',
    reference: 'PO-2025-015',
    performedBy: 'Mary Manager'
  },
  {
    id: 'MOV003',
    date: '2025-06-18',
    product: 'Sugar 2kg',
    type: 'return',
    quantity: 3,
    direction: 'in',
    reference: 'RET-2025-003',
    performedBy: 'Jane Supervisor',
    notes: 'Customer return - damaged packaging'
  },
  {
    id: 'MOV004',
    date: '2025-06-18',
    product: 'Detergent Powder',
    type: 'transfer',
    quantity: 15,
    direction: 'out',
    reference: 'TRF-2025-008',
    performedBy: 'Mike Stock',
    notes: 'Transfer to branch store'
  },
  {
    id: 'MOV005',
    date: '2025-06-17',
    product: 'Rice 25kg',
    type: 'adjustment',
    quantity: 2,
    direction: 'out',
    reference: 'ADJ-2025-002',
    performedBy: 'Mary Manager',
    notes: 'Stock count adjustment'
  },
  {
    id: 'MOV006',
    date: '2025-06-17',
    product: 'Cooking Oil 5L',
    type: 'sale',
    quantity: 18,
    direction: 'out',
    reference: 'SALE-2025-045',
    performedBy: 'Sarah Cashier'
  }
];

export default function ProductMovements() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const totalMovements = movementData.length;
  const itemsIn = movementData.filter(m => m.direction === 'in').reduce((sum, m) => sum + m.quantity, 0);
  const itemsOut = movementData.filter(m => m.direction === 'out').reduce((sum, m) => sum + m.quantity, 0);
  const netMovement = itemsIn - itemsOut;

  const getTypeBadge = (type: string) => {
    const colors = {
      sale: 'bg-green-100 text-green-800',
      purchase: 'bg-blue-100 text-blue-800',
      return: 'bg-yellow-100 text-yellow-800',
      transfer: 'bg-purple-100 text-purple-800',
      adjustment: 'bg-red-100 text-red-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getDirectionIcon = (direction: string, type: string) => {
    if (direction === 'in') {
      return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    } else {
      return <ArrowDownRight className="h-4 w-4 text-red-600" />;
    }
  };

  const filteredData = movementData.filter(item => {
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesDirection = directionFilter === 'all' || item.direction === directionFilter;
    const matchesSearch = item.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.reference.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesDirection && matchesSearch;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // Export functions
  const exportToExcel = () => {
    const csvContent = [
      ['Date', 'Product', 'Type', 'Direction', 'Quantity', 'Reference', 'Performed By', 'Notes'],
      ...filteredData.map(item => [
        item.date,
        item.product,
        item.type,
        item.direction,
        item.quantity,
        item.reference,
        item.performedBy,
        item.notes || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-movements.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const printContent = `
      <html>
        <head>
          <title>Product Movements</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          <h1>Product Movements Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Type</th>
                <th>Direction</th>
                <th>Quantity</th>
                <th>Reference</th>
                <th>Performed By</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(item => `
                <tr>
                  <td>${new Date(item.date).toLocaleDateString()}</td>
                  <td>${item.product}</td>
                  <td>${item.type}</td>
                  <td>${item.direction}</td>
                  <td>${item.quantity}</td>
                  <td>${item.reference}</td>
                  <td>${item.performedBy}</td>
                  <td>${item.notes || ''}</td>
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

  return (
    <DashboardLayout title="Product Movements">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/reports">
              <Button variant="outline" size="sm" className="h-8 shrink-0">
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <TrendingUp className="h-5 w-5 text-blue-600 shrink-0" />
                Product Movements
              </h1>
              <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">Track all inventory movements</p>
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
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Movements</p>
                  <p className="text-2xl font-bold text-blue-600">{totalMovements}</p>
                </div>
                <RotateCcw className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Items In</p>
                  <p className="text-2xl font-bold text-green-600">{itemsIn}</p>
                </div>
                <ArrowUpRight className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Items Out</p>
                  <p className="text-2xl font-bold text-red-600">{itemsOut}</p>
                </div>
                <ArrowDownRight className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Net Movement</p>
                  <p className={`text-2xl font-bold ${netMovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {netMovement >= 0 ? '+' : ''}{netMovement}
                  </p>
                </div>
                <TrendingUp className={`h-8 w-8 ${netMovement >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Movements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex gap-2">
                <Button 
                  variant={typeFilter === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setTypeFilter('all')}
                >
                  All Types
                </Button>
                {['sale', 'purchase', 'return', 'transfer', 'adjustment'].map((type) => (
                  <Button 
                    key={type}
                    variant={typeFilter === type ? 'default' : 'outline'} 
                    size="sm"
                    onClick={() => setTypeFilter(type)}
                    className="capitalize"
                  >
                    {type}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={directionFilter === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setDirectionFilter('all')}
                >
                  All Directions
                </Button>
                <Button 
                  variant={directionFilter === 'in' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setDirectionFilter('in')}
                >
                  In
                </Button>
                <Button 
                  variant={directionFilter === 'out' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setDirectionFilter('out')}
                >
                  Out
                </Button>
              </div>
              <Input
                placeholder="Search product or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
          </CardContent>
        </Card>

        {/* Movements Table */}
        <Card>
          <CardHeader>
            <CardTitle>Movement Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Product</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-center p-3">Direction</th>
                    <th className="text-right p-3">Quantity</th>
                    <th className="text-left p-3">Reference</th>
                    <th className="text-left p-3">Performed By</th>
                    <th className="text-left p-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((movement, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-3">{new Date(movement.date).toLocaleDateString()}</td>
                      <td className="p-3 font-medium">{movement.product}</td>
                      <td className="p-3">
                        <Badge className={getTypeBadge(movement.type)}>
                          {movement.type}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getDirectionIcon(movement.direction, movement.type)}
                          <span className={`text-sm font-medium ${movement.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                            {movement.direction.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-bold">{movement.quantity}</td>
                      <td className="p-3 text-sm font-mono">{movement.reference}</td>
                      <td className="p-3">{movement.performedBy}</td>
                      <td className="p-3 text-sm text-gray-600">{movement.notes || '-'}</td>
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

        {/* Movement Analysis */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Movement Types Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['sale', 'purchase', 'return', 'transfer', 'adjustment'].map((type) => {
                  const count = movementData.filter(m => m.type === type).length;
                  const percentage = ((count / totalMovements) * 100).toFixed(1);
                  return (
                    <div key={type} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge className={getTypeBadge(type)}>
                          {type}
                        </Badge>
                        <span className="font-medium capitalize">{type}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{count} movements</p>
                        <p className="text-sm text-gray-500">{percentage}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {movementData.slice(0, 5).map((movement, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getDirectionIcon(movement.direction, movement.type)}
                      <div>
                        <p className="font-medium">{movement.product}</p>
                        <p className="text-sm text-gray-600">{movement.reference}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{movement.quantity}</p>
                      <p className="text-sm text-gray-500">{new Date(movement.date).toLocaleDateString()}</p>
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