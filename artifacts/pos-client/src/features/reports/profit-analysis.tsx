import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Package, ShoppingCart, Calendar, Filter, Download, Eye, BarChart3, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DashboardLayout from '@/components/layout/dashboard-layout';

interface ProfitData {
  id: string;
  productName: string;
  category: string;
  totalSales: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
  unitsSold: number;
  avgSellingPrice: number;
  avgCostPrice: number;
  profitPerUnit: number;
  lastSold: string;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

interface PeriodProfit {
  period: string;
  revenue: number;
  costs: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  expenses: number;
  itemsSold: number;
}

export default function ProfitAnalysis() {
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('grossProfit');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Mock profit data
  const profitData: ProfitData[] = [
    {
      id: '1',
      productName: 'Premium Coffee Beans',
      category: 'Beverages',
      totalSales: 45000,
      totalCost: 27000,
      grossProfit: 18000,
      profitMargin: 40.0,
      unitsSold: 150,
      avgSellingPrice: 300,
      avgCostPrice: 180,
      profitPerUnit: 120,
      lastSold: '2025-06-19',
      trend: 'up',
      trendPercentage: 12.5
    },
    {
      id: '2',
      productName: 'Wireless Headphones',
      category: 'Electronics',
      totalSales: 85000,
      totalCost: 55000,
      grossProfit: 30000,
      profitMargin: 35.3,
      unitsSold: 85,
      avgSellingPrice: 1000,
      avgCostPrice: 647,
      profitPerUnit: 353,
      lastSold: '2025-06-19',
      trend: 'up',
      trendPercentage: 8.2
    },
    {
      id: '3',
      productName: 'Organic Honey',
      category: 'Food',
      totalSales: 28000,
      totalCost: 16800,
      grossProfit: 11200,
      profitMargin: 40.0,
      unitsSold: 140,
      avgSellingPrice: 200,
      avgCostPrice: 120,
      profitPerUnit: 80,
      lastSold: '2025-06-18',
      trend: 'stable',
      trendPercentage: 0.5
    },
    {
      id: '4',
      productName: 'Designer T-Shirt',
      category: 'Clothing',
      totalSales: 36000,
      totalCost: 21600,
      grossProfit: 14400,
      profitMargin: 40.0,
      unitsSold: 120,
      avgSellingPrice: 300,
      avgCostPrice: 180,
      profitPerUnit: 120,
      lastSold: '2025-06-18',
      trend: 'down',
      trendPercentage: -5.2
    },
    {
      id: '5',
      productName: 'Smartphone Case',
      category: 'Electronics',
      totalSales: 15000,
      totalCost: 7500,
      grossProfit: 7500,
      profitMargin: 50.0,
      unitsSold: 100,
      avgSellingPrice: 150,
      avgCostPrice: 75,
      profitPerUnit: 75,
      lastSold: '2025-06-17',
      trend: 'up',
      trendPercentage: 15.8
    },
    {
      id: '6',
      productName: 'Notebook Set',
      category: 'Stationery',
      totalSales: 8000,
      totalCost: 5600,
      grossProfit: 2400,
      profitMargin: 30.0,
      unitsSold: 80,
      avgSellingPrice: 100,
      avgCostPrice: 70,
      profitPerUnit: 30,
      lastSold: '2025-06-17',
      trend: 'down',
      trendPercentage: -3.1
    }
  ];

  // Mock period data
  const periodData: PeriodProfit[] = [
    {
      period: 'Today',
      revenue: 35000,
      costs: 21000,
      grossProfit: 14000,
      netProfit: 11500,
      profitMargin: 32.9,
      expenses: 2500,
      itemsSold: 45
    },
    {
      period: 'Yesterday',
      revenue: 42000,
      costs: 25200,
      grossProfit: 16800,
      netProfit: 14300,
      profitMargin: 34.0,
      expenses: 2500,
      itemsSold: 52
    },
    {
      period: 'Last 7 Days',
      revenue: 287000,
      costs: 172200,
      grossProfit: 114800,
      netProfit: 97300,
      profitMargin: 33.9,
      expenses: 17500,
      itemsSold: 368
    },
    {
      period: 'Last 30 Days',
      revenue: 1250000,
      costs: 750000,
      grossProfit: 500000,
      netProfit: 425000,
      profitMargin: 34.0,
      expenses: 75000,
      itemsSold: 1580
    }
  ];

  // Filter and sort data
  const filteredData = profitData
    .filter(item => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch = item.productName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      const multiplier = sortOrder === 'desc' ? -1 : 1;
      if (sortBy === 'grossProfit') return (a.grossProfit - b.grossProfit) * multiplier;
      if (sortBy === 'profitMargin') return (a.profitMargin - b.profitMargin) * multiplier;
      if (sortBy === 'totalSales') return (a.totalSales - b.totalSales) * multiplier;
      if (sortBy === 'unitsSold') return (a.unitsSold - b.unitsSold) * multiplier;
      return 0;
    });

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // Export functions
  const exportToExcel = () => {
    const csvContent = [
      ['Product', 'Category', 'Sales', 'Costs', 'Gross Profit', 'Margin %', 'Units Sold', 'Profit/Unit'],
      ...filteredData.map(item => [
        item.productName,
        item.category,
        item.totalSales,
        item.totalCost,
        item.grossProfit,
        item.profitMargin,
        item.unitsSold,
        item.profitPerUnit
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'profit-analysis.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const printContent = `
      <html>
        <head>
          <title>Profit Analysis</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          <h1>Profit Analysis</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Sales</th>
                <th>Costs</th>
                <th>Gross Profit</th>
                <th>Margin %</th>
                <th>Units Sold</th>
                <th>Profit/Unit</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(item => `
                <tr>
                  <td>${item.productName}</td>
                  <td>${item.category}</td>
                  <td>${formatCurrency(item.totalSales)}</td>
                  <td>${formatCurrency(item.totalCost)}</td>
                  <td>${formatCurrency(item.grossProfit)}</td>
                  <td>${item.profitMargin.toFixed(1)}%</td>
                  <td>${item.unitsSold}</td>
                  <td>${formatCurrency(item.profitPerUnit)}</td>
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

  const categories = Array.from(new Set(profitData.map(item => item.category)));

  // Calculate totals
  const totalRevenue = filteredData.reduce((sum, item) => sum + item.totalSales, 0);
  const totalCosts = filteredData.reduce((sum, item) => sum + item.totalCost, 0);
  const totalGrossProfit = totalRevenue - totalCosts;
  const averageProfitMargin = filteredData.length > 0 ? 
    filteredData.reduce((sum, item) => sum + item.profitMargin, 0) / filteredData.length : 0;

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DashboardLayout title="Profit Analysis">
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold truncate">{formatCurrency(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">From {filteredData.length} products</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Gross Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold text-green-600 truncate">{formatCurrency(totalGrossProfit)}</div>
              <p className="text-xs text-muted-foreground">
                {((totalGrossProfit / totalRevenue) * 100).toFixed(1)}% margin
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Total Costs</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold text-red-600 truncate">{formatCurrency(totalCosts)}</div>
              <p className="text-xs text-muted-foreground">Cost of goods sold</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium">Avg Profit Margin</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold">{averageProfitMargin.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Across all products</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="products" className="space-y-4">
          <TabsList>
            <TabsTrigger value="products">Product Analysis</TabsTrigger>
            <TabsTrigger value="periods">Period Analysis</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Product Profit Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <Input
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grossProfit">Gross Profit</SelectItem>
                      <SelectItem value="profitMargin">Profit Margin</SelectItem>
                      <SelectItem value="totalSales">Total Sales</SelectItem>
                      <SelectItem value="unitsSold">Units Sold</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  >
                    {sortOrder === 'desc' ? 'High to Low' : 'Low to High'}
                  </Button>
                  
                  <div className="flex gap-2 ml-auto">
                    <Button onClick={exportToExcel} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                    <Button onClick={exportToPDF} variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="hidden sm:table-cell">Category</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Costs</TableHead>
                        <TableHead className="text-right">Gross Profit</TableHead>
                        <TableHead className="text-right">Margin %</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Units Sold</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Profit/Unit</TableHead>
                        <TableHead className="text-right hidden lg:table-cell">Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div className="text-sm">{item.productName}</div>
                              <div className="text-xs text-gray-500 sm:hidden">{item.category}</div>
                              <div className="text-xs text-gray-500 hidden sm:block">Last sold: {item.lastSold}</div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline">{item.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm">
                            {formatCurrency(item.totalSales)}
                          </TableCell>
                          <TableCell className="text-right text-red-600 hidden sm:table-cell">
                            {formatCurrency(item.totalCost)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600 text-sm">
                            {formatCurrency(item.grossProfit)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={item.profitMargin >= 40 ? "default" : item.profitMargin >= 30 ? "secondary" : "destructive"} className="text-xs">
                              {item.profitMargin.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right hidden md:table-cell">{item.unitsSold}</TableCell>
                          <TableCell className="text-right text-green-600 hidden md:table-cell">
                            {formatCurrency(item.profitPerUnit)}
                          </TableCell>
                          <TableCell className="text-right hidden lg:table-cell">
                            <div className={`flex items-center justify-end gap-1 ${getTrendColor(item.trend)}`}>
                              {getTrendIcon(item.trend)}
                              <span className="text-sm font-medium">{item.trendPercentage}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="periods" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Period Profit Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Costs</TableHead>
                        <TableHead className="text-right">Expenses</TableHead>
                        <TableHead className="text-right">Gross Profit</TableHead>
                        <TableHead className="text-right">Net Profit</TableHead>
                        <TableHead className="text-right">Margin %</TableHead>
                        <TableHead className="text-right">Items Sold</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periodData.map((period, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{period.period}</TableCell>
                          <TableCell className="text-right">{formatCurrency(period.revenue)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(period.costs)}</TableCell>
                          <TableCell className="text-right text-orange-600">{formatCurrency(period.expenses)}</TableCell>
                          <TableCell className="text-right text-green-600 font-medium">{formatCurrency(period.grossProfit)}</TableCell>
                          <TableCell className="text-right text-green-700 font-bold">{formatCurrency(period.netProfit)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={period.profitMargin >= 35 ? "default" : period.profitMargin >= 25 ? "secondary" : "destructive"}>
                              {period.profitMargin.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{period.itemsSold}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-green-600">Top Performers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium">Highest Profit Margin</h4>
                      <p className="text-sm text-gray-600">Smartphone Case (50.0%)</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Highest Gross Profit</h4>
                      <p className="text-sm text-gray-600">Wireless Headphones ({formatCurrency(30000)})</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Best Selling</h4>
                      <p className="text-sm text-gray-600">Premium Coffee Beans (150 units)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-red-600">Areas for Improvement</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium">Lowest Profit Margin</h4>
                      <p className="text-sm text-gray-600">Notebook Set (30.0%)</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Declining Trend</h4>
                      <p className="text-sm text-gray-600">Designer T-Shirt (-5.2%)</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Low Volume, High Margin</h4>
                      <p className="text-sm text-gray-600">Consider promoting Smartphone Case</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Profit Analysis Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <h4 className="font-medium text-green-800 dark:text-green-200">Strong Performance</h4>
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        Electronics category showing consistent 35%+ margins with strong sales volume
                      </p>
                    </div>
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Optimization Opportunity</h4>
                      <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                        Food and Beverages showing good margins but could increase volume through promotions
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h4 className="font-medium text-blue-800 dark:text-blue-200">Growth Potential</h4>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        High-margin products like Smartphone Case have low sales volume - consider marketing push
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export Profit Report
          </Button>
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Report
          </Button>
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            View Detailed Analysis
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}