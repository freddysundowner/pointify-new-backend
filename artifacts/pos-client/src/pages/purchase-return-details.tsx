import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, Calendar, User, Receipt, DollarSign } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigationRoute } from "@/lib/navigation-utils";

interface PurchaseReturnItem {
  product: {
    _id: string;
    name: string;
  };
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
}

interface PurchaseReturnDetails {
  _id: string;
  purchaseId: string;
  paymentType?: string;
  supplierId?: any;
  attendantId: {
    _id: string;
    username: string;
  };
  shopId: {
    _id: string;
    name: string;
    currency: string;
  };
  items: PurchaseReturnItem[];
  refundAmount?: number;
  totalAmount?: number;
  reason?: string;
  createdAt?: string;
  returnDate?: string;
  purchaseReturnNo?: string;
  status?: string;
}

export default function PurchaseReturnDetails() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [returnData, setReturnData] = useState<PurchaseReturnDetails | null>(null);
  // Determine the correct back route based on current path
  const currentPath = window.location.pathname;
  const isAttendantRoute = currentPath.startsWith('/attendant/');
  // For attendants, go to dashboard instead of returns page
  const purchaseReturnsRoute = isAttendantRoute ? '/attendant/dashboard' : '/purchase-returns';

  useEffect(() => {
    // Check if data was passed via window object
    const passedData = (window as any).__returnData;
    if (passedData) {
      setReturnData(passedData);
      // Clean up the data after use
      delete (window as any).__returnData;
    }
  }, [id]);

  if (!returnData) {
    return (
      <DashboardLayout title="Return Details">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setLocation(purchaseReturnsRoute)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {isAttendantRoute ? 'Back to Dashboard' : 'Back to Returns'}
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                Return details not found. Please go back and try again.
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const formatCurrency = (amount: number) => {
    return `${returnData.shopId.currency} ${amount?.toLocaleString() || '0'}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
  };

  const totalReturnAmount = returnData.refundAmount || returnData.totalAmount || 0;
  const totalItems = returnData.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <DashboardLayout title="Purchase Return Details">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setLocation(purchaseReturnsRoute)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {isAttendantRoute ? 'Back to Dashboard' : 'Back to Returns'}
            </Button>
            <h2 className="text-xl font-semibold">Return Details</h2>
          </div>
          <Badge variant="outline" className="text-sm">
            {returnData.purchaseReturnNo || returnData._id.slice(-8)}
          </Badge>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Purchase ID
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold font-mono">
                {returnData.purchaseId?.slice(-8) || 'N/A'}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Return Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {formatCurrency(totalReturnAmount)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" />
                Total Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {totalItems}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Return Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {formatDate(returnData.createdAt || returnData.returnDate || '')}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Return Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Return Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Attendant</label>
                <div className="text-sm mt-1">{returnData.attendantId?.username || 'Unknown'}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Shop</label>
                <div className="text-sm mt-1">{returnData.shopId?.name || 'Unknown'}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Payment Type</label>
                <div className="text-sm mt-1">{returnData.paymentType || 'N/A'}</div>
              </div>
              {returnData.reason && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Reason</label>
                  <div className="text-sm mt-1 p-2 bg-muted rounded">
                    {returnData.reason}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shop Details */}
          <Card>
            <CardHeader>
              <CardTitle>Shop Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Shop Name</label>
                <div className="text-sm mt-1">{returnData.shopId?.name || 'Unknown'}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Currency</label>
                <div className="text-sm mt-1">{returnData.shopId?.currency || 'N/A'}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Return ID</label>
                <div className="text-sm mt-1 font-mono">{returnData._id}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Returned Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Returned Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnData.items?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {item.product?.name || 'Unknown Product'}
                      </TableCell>
                      <TableCell>
                        {item.quantity}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(item.unitPrice || 0)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency((item.unitPrice || 0) * item.quantity)}
                      </TableCell>
                    </TableRow>
                  )) || (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No items found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}