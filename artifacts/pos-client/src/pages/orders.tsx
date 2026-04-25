import { useEffect, useState } from "react";
import { Search, Filter, Plus, Eye, CheckCircle, XCircle, Clock, Truck, Phone, Mail, MapPin, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useQuery } from "@tanstack/react-query";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { apiCall } from "@/lib/api-config";
import { useCart } from "@/hooks/useCart";
import { useProducts } from "@/contexts/ProductsContext";
import { navigate } from "wouter/use-browser-location";
const statusColors:any = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  preparing: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  ready: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  delivered: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const sourceColors = {
  website: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  app: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  phone: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  whatsapp: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

interface Order {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  items: { productName: string; quantity: number; unitPrice: number; totalPrice: number }[];
  totalAmount: number;
  orderDate: string;
  status: string;
  orderSource: string;
  deliveryAddress: string;
  notes: string;
}


export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const  primaryShopData: any = usePrimaryShop();
  const { products } = useProducts(); // used for pricing logic
  const { addToCart, clearCart,updateCartPricesForSaleType, setOrderId } = useCart(products, 0, "Retail"); // set taxRate and saleType as needed
  const [saleType, setSaleType] = useState<"Retail" | "Wholesale" | "Dealer">("Retail");

  const { data: allorders, isLoading: summaryLoading,refetch } = useQuery({
    queryKey: ["/api/product-summary", primaryShopData?.shopId,],
    queryFn: async () => {
      const response = await apiCall(`/api/sales/shop/onlineorders/${primaryShopData?.shopId}?status=${statusFilter}`, {
        method: "GET",
      });
      return await response.json();
    },
    enabled: !!primaryShopData?.shopId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    refetch();
  }, [statusFilter,refetch]);


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return `KSh ${amount.toLocaleString()}`;
  };

  const updateOrderStatus = (orderId: number, newStatus: Order['status']) => {
    // In a real app, this would make an API call
    console.log(`Updating order ${orderId} to status: ${newStatus}`);
  };

  const convertToSale = (orderId: any) => {
    const order = allorders?.data?.find((o: any) => o._id === orderId);
    if (!order) return;
  
    clearCart();
  
    order.items.forEach((item: any) => {
      const matchedProduct = products.find((p: any) => p._id === item.product._id);
  
      const productData = matchedProduct
        ? { ...matchedProduct, quantity: item.quantity }
        : {
            id: item.product._id || item.product.id,
            name: item.product.name || "Unknown Product",
            quantity: item.quantity,
            price: item.sellingPrice,
            originalPrice: item.sellingPrice,
            discount: 0,
            maxDiscount: item.product.maxDiscount || 0,
            virtual: item.product.virtual || false,
            serialnumber: item.product.serialnumber || undefined,
          };
  
      addToCart(productData, orderId);   // ✅ pass it explicitly
    });
  
    updateCartPricesForSaleType(saleType);
    navigate("/pos");
  };
  
  
  return (
    <DashboardLayout title="Orders">
      <div className="space-y-6 w-full">

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search orders by customer, phone, or order ID..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        

        {/* Orders List */}
        <div className="grid gap-4">
          {summaryLoading ? <p className="text-gray-600 dark:text-gray-400 justify-center">Loading orders...</p> : allorders?.data?.length ==0 && <p className="text-gray-600 dark:text-gray-400">No orders found</p>} {allorders?.data?.map((order) => (
            <Card key={order._id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  
                  {/* Order Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">Order #{order.receiptNo}</h3>
                      <Badge className={statusColors[order.status]}>
                        {order.status}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <ShoppingBag className="h-4 w-4" />
                        <span>{order?.customer?.name}</span>
                      </div>
                      {order?.customer?.phonenumber && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          <span>{order?.customer?.phonenumber}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {order.items.length} item(s)
                      </span>
                      <span className="text-gray-400">•</span>
                      {/* <span className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(order?.totalAmount)}
                      </span> */}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Dialog>
                      {order?.status == 'completed' ? <></>: (
                        <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </DialogTrigger>
                      )}
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Order #{selectedOrder?.receiptNo} Details</DialogTitle>
                        </DialogHeader>
                        {selectedOrder && (
                          <div className="space-y-6">
                            {/* Customer Info */}
                            <div>
                              <h4 className="font-semibold mb-3">Customer Information</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <ShoppingBag className="h-4 w-4 text-gray-400" />
                                  <span>{selectedOrder.customer.name}</span>
                                </div>
                                {selectedOrder.customer.phonenumber && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-gray-400" />
                                    <span>{selectedOrder.customer.phonenumber}</span>
                                  </div>
                                )}
                                {selectedOrder.customer.email && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-gray-400" />
                                    <span>{selectedOrder.customer.email}</span>
                                  </div>
                                )}
                                {selectedOrder.deliveryAddress && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-gray-400" />
                                    <span>{selectedOrder.deliveryAddress}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <Separator />

                            {/* Order Items */}
                            <div>
                              <h4 className="font-semibold mb-3">Order Items</h4>
                              <div className="space-y-3">
                                {selectedOrder.items.map((item: any, index) => (
                                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div>
                                      <div className="font-medium">{item.product.name}</div>
                                      <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Qty: {item.quantity} × {formatCurrency(item?.sellingPrice)}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {selectedOrder.notes && (
                              <>
                                <Separator />
                                <div>
                                  <h4 className="font-semibold mb-2">Notes</h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedOrder.notes}</p>
                                </div>
                              </>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-4">
                              <Button onClick={() => convertToSale(selectedOrder._id)} className="flex-1">
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Convert to Sale
                              </Button>
                              <Select onValueChange={(value) => updateOrderStatus(selectedOrder.id, value as Order['status'])}>
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue placeholder="Update Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    {order.status === "ready" && (
                      <Button size="sm" onClick={() => convertToSale(order._id)}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Convert to Sale
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
}