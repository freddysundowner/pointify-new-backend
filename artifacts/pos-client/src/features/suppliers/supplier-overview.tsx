import { useState } from 'react';
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, Download, FileText, Filter, Calendar, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';
import DashboardLayout from '@/components/layout/dashboard-layout';

interface Supplier {
  _id: string;
  name: string;
  contact: string;
  email?: string;
  phone?: string;
  address?: string;
  status: 'active' | 'inactive';
  totalOrders?: number;
  totalAmount?: number;
  lastOrder?: string;
}

interface SupplierPurchase {
  _id: string;
  date: string;
  orderNumber: string;
  items: string[];
  totalAmount: number;
  status: 'pending' | 'ordered' | 'received' | 'cancelled';
  expectedDate?: string;
  receivedDate?: string;
}

const mockSuppliers: Supplier[] = [
  {
    _id: '1',
    name: 'ABC Electronics Ltd',
    contact: 'John Smith',
    email: 'john@abcelectronics.com',
    phone: '+1-555-0123',
    address: '123 Business St, Tech City, TC 12345',
    status: 'active',
    totalOrders: 45,
    totalAmount: 125000,
    lastOrder: '2024-01-15'
  },
  {
    _id: '2',
    name: 'Global Supply Co',
    contact: 'Sarah Johnson',
    email: 'sarah@globalsupply.com',
    phone: '+1-555-0456',
    address: '456 Commerce Ave, Supply Town, ST 67890',
    status: 'active',
    totalOrders: 32,
    totalAmount: 89000,
    lastOrder: '2024-01-10'
  },
  {
    _id: '3',
    name: 'Tech Components Inc',
    contact: 'Mike Wilson',
    email: 'mike@techcomponents.com',
    phone: '+1-555-0789',
    address: '789 Innovation Blvd, Tech Hub, TH 11111',
    status: 'inactive',
    totalOrders: 18,
    totalAmount: 45000,
    lastOrder: '2023-12-20'
  }
];

const mockSupplierPurchases: SupplierPurchase[] = [
  {
    _id: '1',
    date: '2024-06-15',
    orderNumber: 'PO-2024-001',
    items: ['Electronic Components', 'Resistors Pack', 'Capacitors Set'],
    totalAmount: 5000.00,
    status: 'received',
    expectedDate: '2024-06-20',
    receivedDate: '2024-06-18'
  },
  {
    _id: '2',
    date: '2024-06-10',
    orderNumber: 'PO-2024-002',
    items: ['Inventory Restock', 'Office Supplies'],
    totalAmount: 2500.00,
    status: 'pending',
    expectedDate: '2024-06-25'
  },
  {
    _id: '3',
    date: '2024-06-08',
    orderNumber: 'PO-2024-003',
    items: ['Monthly Supply Order', 'Packaging Materials'],
    totalAmount: 1800.00,
    status: 'ordered',
    expectedDate: '2024-06-22'
  },
  {
    _id: '4',
    date: '2024-06-05',
    orderNumber: 'PO-2024-004',
    items: ['Special Equipment', 'Tools'],
    totalAmount: 3200.00,
    status: 'received',
    expectedDate: '2024-06-12',
    receivedDate: '2024-06-11'
  },
  {
    _id: '5',
    date: '2024-06-01',
    orderNumber: 'PO-2024-005',
    items: ['Raw Materials', 'Production Supplies'],
    totalAmount: 4500.00,
    status: 'cancelled',
    expectedDate: '2024-06-15'
  },
  {
    _id: '6',
    date: '2024-05-28',
    orderNumber: 'PO-2024-006',
    items: ['Hardware Components', 'Cables'],
    totalAmount: 1200.00,
    status: 'received',
    expectedDate: '2024-06-05',
    receivedDate: '2024-06-03'
  }
];

export default function SupplierOverview() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("purchases");
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const { toast } = useToast();
  
  // Get supplier ID from URL parameters
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const supplierId = urlParams.get('id');

  // Find the supplier data
  const supplier = mockSuppliers.find(s => s._id === supplierId) || mockSuppliers[0];

  // Filter purchases based on status and date
  const getFilteredPurchases = () => {
    let filtered = mockSupplierPurchases;
    
    // Filter by status
    if (purchaseStatusFilter !== "all") {
      filtered = filtered.filter(purchase => purchase.status === purchaseStatusFilter);
    }
    
    // Filter by date
    if (dateFilter !== "all") {
      const now = new Date();
      const filterDate = new Date();
      
      if (dateFilter === "7days") {
        filterDate.setDate(now.getDate() - 7);
      } else if (dateFilter === "30days") {
        filterDate.setDate(now.getDate() - 30);
      } else if (dateFilter === "90days") {
        filterDate.setDate(now.getDate() - 90);
      }
      
      filtered = filtered.filter(purchase => new Date(purchase.date) >= filterDate);
    }
    
    return filtered;
  };

  // Download supplier purchases as CSV
  const downloadSupplierPurchasesCSV = () => {
    const currentDate = new Date().toLocaleDateString();
    const filteredPurchases = getFilteredPurchases();
    
    let csvContent = `Supplier Purchases Report\n`;
    csvContent += `Supplier: ${supplier.name}\n`;
    csvContent += `Contact: ${supplier.contact}\n`;
    csvContent += `Generated: ${currentDate}\n`;
    csvContent += `\n`;
    csvContent += `Date,Order Number,Items,Amount,Status,Expected Date,Received Date\n`;
    
    filteredPurchases.forEach(purchase => {
      csvContent += `${new Date(purchase.date).toLocaleDateString()},`;
      csvContent += `${purchase.orderNumber},`;
      csvContent += `"${purchase.items.join(', ')}",`;
      csvContent += `${purchase.totalAmount.toFixed(2)},`;
      csvContent += `${purchase.status},`;
      csvContent += `${purchase.expectedDate ? new Date(purchase.expectedDate).toLocaleDateString() : ''},`;
      csvContent += `${purchase.receivedDate ? new Date(purchase.receivedDate).toLocaleDateString() : ''}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${supplier.name.replace(/\s+/g, '_')}_Purchases_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV Downloaded",
      description: "Supplier purchases CSV has been downloaded successfully",
    });
  };

  return (
    <DashboardLayout title={`${supplier.name} - Overview`}>
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center space-x-4">
          <Link href="/suppliers">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Suppliers
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{supplier.name}</h1>
            <p className="text-gray-600">{supplier.contact}</p>
          </div>
        </div>

        {/* Supplier Info Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {supplier.totalOrders || 0}
            </div>
            <div className="text-sm text-gray-600">Total Orders</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ${(supplier.totalAmount || 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Amount</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${supplier.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
              {supplier.status.toUpperCase()}
            </div>
            <div className="text-sm text-gray-600">Status</div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
            <TabsTrigger value="stats">Account Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="purchases" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Purchase Orders</CardTitle>
                    <CardDescription>All purchase orders from {supplier.name}</CardDescription>
                  </div>
                  <Button onClick={downloadSupplierPurchasesCSV} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
                
                {/* Filters */}
                <div className="flex space-x-4 mt-4">
                  <div className="flex items-center space-x-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Select value={purchaseStatusFilter} onValueChange={setPurchaseStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="ordered">Ordered</SelectItem>
                        <SelectItem value="received">Received</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="7days">Last 7 Days</SelectItem>
                        <SelectItem value="30days">Last 30 Days</SelectItem>
                        <SelectItem value="90days">Last 90 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Order Number</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expected Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredPurchases().map((purchase) => (
                        <TableRow key={purchase._id}>
                          <TableCell>{new Date(purchase.date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">{purchase.orderNumber}</TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={purchase.items.join(', ')}>
                              {purchase.items.join(', ')}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${purchase.totalAmount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={
                                purchase.status === 'received' ? 'bg-green-100 text-green-800' :
                                purchase.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                purchase.status === 'ordered' ? 'bg-blue-100 text-blue-800' :
                                'bg-red-100 text-red-800'
                              }
                            >
                              {purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {purchase.expectedDate ? new Date(purchase.expectedDate).toLocaleDateString() : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {getFilteredPurchases().length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No purchases found matching the selected filters.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-blue-600">{supplier.totalOrders || 0}</div>
                  <p className="text-sm text-gray-600">Total Orders</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-green-600">
                    ${(supplier.totalAmount || 0).toLocaleString()}
                  </div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-purple-600">
                    {mockSupplierPurchases.filter(p => p.status === 'pending').length}
                  </div>
                  <p className="text-sm text-gray-600">Pending Orders</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-orange-600">
                    {supplier.lastOrder ? new Date(supplier.lastOrder).toLocaleDateString() : 'Never'}
                  </div>
                  <p className="text-sm text-gray-600">Last Order</p>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Purchase Summary by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['pending', 'ordered', 'received', 'cancelled'].map(status => {
                    const count = mockSupplierPurchases.filter(p => p.status === status).length;
                    const amount = mockSupplierPurchases.filter(p => p.status === status).reduce((sum, p) => sum + p.totalAmount, 0);
                    return (
                      <div key={status} className="flex justify-between items-center p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Badge 
                            className={
                              status === 'received' ? 'bg-green-100 text-green-800' :
                              status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              status === 'ordered' ? 'bg-blue-100 text-blue-800' :
                              'bg-red-100 text-red-800'
                            }
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </Badge>
                          <span className="font-medium">{count} orders</span>
                        </div>
                        <span className="font-bold">${amount.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}