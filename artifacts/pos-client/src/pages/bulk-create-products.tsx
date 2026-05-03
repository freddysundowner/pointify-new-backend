import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, CheckCircle, XCircle } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { extractId } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const productTemplates = [
  // Electronics (12 products)
  { name: 'Smartphone Galaxy S24', category: 'Electronics', buyingPrice: 300, sellingPrice: 450, quantity: 25 },
  { name: 'MacBook Pro 16"', category: 'Electronics', buyingPrice: 800, sellingPrice: 1200, quantity: 15 },
  { name: 'iPad Air 5th Gen', category: 'Electronics', buyingPrice: 250, sellingPrice: 375, quantity: 20 },
  { name: 'Sony WH-1000XM5', category: 'Electronics', buyingPrice: 50, sellingPrice: 75, quantity: 40 },
  { name: 'JBL Charge 5', category: 'Electronics', buyingPrice: 80, sellingPrice: 120, quantity: 30 },
  { name: 'Apple Watch Series 9', category: 'Electronics', buyingPrice: 150, sellingPrice: 225, quantity: 18 },
  { name: 'USB-C Charger 67W', category: 'Electronics', buyingPrice: 10, sellingPrice: 20, quantity: 100 },
  { name: 'Anker PowerCore 20K', category: 'Electronics', buyingPrice: 25, sellingPrice: 40, quantity: 50 },
  { name: 'Canon EOS R50', category: 'Electronics', buyingPrice: 400, sellingPrice: 600, quantity: 12 },
  { name: 'PlayStation 5', category: 'Electronics', buyingPrice: 350, sellingPrice: 525, quantity: 8 },
  { name: 'Samsung 55" QLED TV', category: 'Electronics', buyingPrice: 500, sellingPrice: 750, quantity: 10 },
  { name: 'Logitech MX Master 3S', category: 'Electronics', buyingPrice: 15, sellingPrice: 25, quantity: 60 },

  // Groceries (12 products)
  { name: 'Basmati Rice 5kg', category: 'Groceries', buyingPrice: 8, sellingPrice: 12, quantity: 200 },
  { name: 'Sunflower Oil 1L', category: 'Groceries', buyingPrice: 3, sellingPrice: 5, quantity: 150 },
  { name: 'White Sugar 2kg', category: 'Groceries', buyingPrice: 4, sellingPrice: 6, quantity: 180 },
  { name: 'All Purpose Flour 2kg', category: 'Groceries', buyingPrice: 3, sellingPrice: 5, quantity: 160 },
  { name: 'Kenya Tea Leaves 500g', category: 'Groceries', buyingPrice: 5, sellingPrice: 8, quantity: 120 },
  { name: 'Arabica Coffee 250g', category: 'Groceries', buyingPrice: 7, sellingPrice: 12, quantity: 80 },
  { name: 'Fresh Bread Loaf', category: 'Groceries', buyingPrice: 1, sellingPrice: 2, quantity: 50 },
  { name: 'Fresh Milk 1L', category: 'Groceries', buyingPrice: 2, sellingPrice: 3, quantity: 100 },
  { name: 'Farm Eggs 12pc', category: 'Groceries', buyingPrice: 3, sellingPrice: 5, quantity: 75 },
  { name: 'Roma Tomatoes 1kg', category: 'Groceries', buyingPrice: 2, sellingPrice: 4, quantity: 90 },
  { name: 'Red Onions 2kg', category: 'Groceries', buyingPrice: 3, sellingPrice: 5, quantity: 85 },
  { name: 'Irish Potatoes 3kg', category: 'Groceries', buyingPrice: 4, sellingPrice: 7, quantity: 110 },

  // Clothing (12 products)
  { name: 'Cotton T-Shirt', category: 'Clothing', buyingPrice: 8, sellingPrice: 15, quantity: 80 },
  { name: 'Denim Jeans', category: 'Clothing', buyingPrice: 20, sellingPrice: 35, quantity: 45 },
  { name: 'Business Shirt', category: 'Clothing', buyingPrice: 15, sellingPrice: 28, quantity: 35 },
  { name: 'Nike Air Max', category: 'Clothing', buyingPrice: 30, sellingPrice: 55, quantity: 40 },
  { name: 'Winter Jacket', category: 'Clothing', buyingPrice: 40, sellingPrice: 70, quantity: 25 },
  { name: 'Cotton Socks Pack', category: 'Clothing', buyingPrice: 3, sellingPrice: 6, quantity: 120 },
  { name: 'Boxer Shorts 3-Pack', category: 'Clothing', buyingPrice: 5, sellingPrice: 10, quantity: 100 },
  { name: 'Leather Belt', category: 'Clothing', buyingPrice: 10, sellingPrice: 18, quantity: 60 },
  { name: 'Baseball Cap', category: 'Clothing', buyingPrice: 8, sellingPrice: 15, quantity: 70 },
  { name: 'Wool Scarf', category: 'Clothing', buyingPrice: 12, sellingPrice: 22, quantity: 50 },
  { name: 'Pullover Sweater', category: 'Clothing', buyingPrice: 25, sellingPrice: 45, quantity: 30 },
  { name: 'Cargo Shorts', category: 'Clothing', buyingPrice: 12, sellingPrice: 22, quantity: 55 },

  // Home & Garden (12 products)
  { name: 'Oak Dining Table', category: 'Home & Garden', buyingPrice: 150, sellingPrice: 250, quantity: 8 },
  { name: 'Ergonomic Chair', category: 'Home & Garden', buyingPrice: 40, sellingPrice: 70, quantity: 32 },
  { name: 'Queen Bed Frame', category: 'Home & Garden', buyingPrice: 200, sellingPrice: 350, quantity: 6 },
  { name: 'Memory Foam Mattress', category: 'Home & Garden', buyingPrice: 180, sellingPrice: 300, quantity: 10 },
  { name: 'Blackout Curtains', category: 'Home & Garden', buyingPrice: 25, sellingPrice: 45, quantity: 40 },
  { name: 'Memory Foam Pillow', category: 'Home & Garden', buyingPrice: 15, sellingPrice: 25, quantity: 60 },
  { name: 'Fleece Blanket', category: 'Home & Garden', buyingPrice: 30, sellingPrice: 50, quantity: 45 },
  { name: 'Garden Tool Set', category: 'Home & Garden', buyingPrice: 35, sellingPrice: 60, quantity: 20 },
  { name: 'Ceramic Flower Pot', category: 'Home & Garden', buyingPrice: 8, sellingPrice: 15, quantity: 80 },
  { name: 'LED Table Lamp', category: 'Home & Garden', buyingPrice: 20, sellingPrice: 35, quantity: 35 },
  { name: 'Round Wall Mirror', category: 'Home & Garden', buyingPrice: 25, sellingPrice: 40, quantity: 25 },
  { name: 'Persian Style Rug', category: 'Home & Garden', buyingPrice: 45, sellingPrice: 75, quantity: 18 },

  // Sports (12 products)
  { name: 'FIFA Official Football', category: 'Sports', buyingPrice: 15, sellingPrice: 25, quantity: 30 },
  { name: 'Spalding Basketball', category: 'Sports', buyingPrice: 18, sellingPrice: 30, quantity: 25 },
  { name: 'Wilson Tennis Racket', category: 'Sports', buyingPrice: 40, sellingPrice: 70, quantity: 15 },
  { name: 'Adidas Running Shoes', category: 'Sports', buyingPrice: 50, sellingPrice: 85, quantity: 35 },
  { name: 'Nike Gym Bag', category: 'Sports', buyingPrice: 20, sellingPrice: 35, quantity: 40 },
  { name: 'Hydro Flask 32oz', category: 'Sports', buyingPrice: 8, sellingPrice: 15, quantity: 100 },
  { name: 'Premium Yoga Mat', category: 'Sports', buyingPrice: 15, sellingPrice: 28, quantity: 50 },
  { name: 'Adjustable Dumbbells', category: 'Sports', buyingPrice: 25, sellingPrice: 45, quantity: 20 },
  { name: 'Speed Jump Rope', category: 'Sports', buyingPrice: 5, sellingPrice: 10, quantity: 80 },
  { name: 'Everlast Boxing Gloves', category: 'Sports', buyingPrice: 30, sellingPrice: 55, quantity: 18 },
  { name: 'Specialized Helmet', category: 'Sports', buyingPrice: 35, sellingPrice: 60, quantity: 22 },
  { name: 'Team Sports Jersey', category: 'Sports', buyingPrice: 18, sellingPrice: 32, quantity: 45 },

  // Books (12 products)
  { name: 'The Seven Husbands Novel', category: 'Books', buyingPrice: 8, sellingPrice: 15, quantity: 150 },
  { name: 'Advanced Mathematics', category: 'Books', buyingPrice: 25, sellingPrice: 45, quantity: 80 },
  { name: 'International Cookbook', category: 'Books', buyingPrice: 12, sellingPrice: 22, quantity: 60 },
  { name: 'Oxford English Dictionary', category: 'Books', buyingPrice: 15, sellingPrice: 28, quantity: 40 },
  { name: 'Modern Art Collection', category: 'Books', buyingPrice: 20, sellingPrice: 35, quantity: 30 },
  { name: 'Illustrated Children Book', category: 'Books', buyingPrice: 6, sellingPrice: 12, quantity: 120 },
  { name: 'National Geographic', category: 'Books', buyingPrice: 3, sellingPrice: 6, quantity: 200 },
  { name: 'Leather Bound Journal', category: 'Books', buyingPrice: 8, sellingPrice: 15, quantity: 70 },
  { name: 'World Atlas 2024', category: 'Books', buyingPrice: 18, sellingPrice: 32, quantity: 25 },
  { name: 'Traditional Recipe Book', category: 'Books', buyingPrice: 10, sellingPrice: 18, quantity: 50 },
  { name: 'Atomic Habits', category: 'Books', buyingPrice: 12, sellingPrice: 22, quantity: 65 },
  { name: 'Marvel Comic Collection', category: 'Books', buyingPrice: 4, sellingPrice: 8, quantity: 100 },

  // Health & Beauty (12 products)
  { name: 'Keratin Repair Shampoo', category: 'Health & Beauty', buyingPrice: 8, sellingPrice: 15, quantity: 90 },
  { name: 'Organic Olive Soap', category: 'Health & Beauty', buyingPrice: 2, sellingPrice: 4, quantity: 200 },
  { name: 'Fluoride Toothpaste', category: 'Health & Beauty', buyingPrice: 3, sellingPrice: 6, quantity: 150 },
  { name: 'Bamboo Toothbrush', category: 'Health & Beauty', buyingPrice: 2, sellingPrice: 4, quantity: 180 },
  { name: 'Anti-Aging Face Cream', category: 'Health & Beauty', buyingPrice: 12, sellingPrice: 22, quantity: 60 },
  { name: 'French Perfume 50ml', category: 'Health & Beauty', buyingPrice: 25, sellingPrice: 45, quantity: 40 },
  { name: 'Long-Lasting Nail Polish', category: 'Health & Beauty', buyingPrice: 5, sellingPrice: 10, quantity: 80 },
  { name: 'Matte Lipstick', category: 'Health & Beauty', buyingPrice: 8, sellingPrice: 15, quantity: 70 },
  { name: 'SPF 50 Sunscreen', category: 'Health & Beauty', buyingPrice: 10, sellingPrice: 18, quantity: 85 },
  { name: 'Strong Hold Hair Gel', category: 'Health & Beauty', buyingPrice: 6, sellingPrice: 12, quantity: 100 },
  { name: '24h Deodorant', category: 'Health & Beauty', buyingPrice: 4, sellingPrice: 8, quantity: 120 },
  { name: 'Moisturizing Body Lotion', category: 'Health & Beauty', buyingPrice: 7, sellingPrice: 13, quantity: 95 },

  // Automotive (12 products)
  { name: 'AGM Car Battery 12V', category: 'Automotive', buyingPrice: 80, sellingPrice: 130, quantity: 15 },
  { name: 'Synthetic Engine Oil 5L', category: 'Automotive', buyingPrice: 20, sellingPrice: 35, quantity: 60 },
  { name: 'All-Season Tires 205/55R16', category: 'Automotive', buyingPrice: 60, sellingPrice: 100, quantity: 24 },
  { name: 'Complete Car Wash Kit', category: 'Automotive', buyingPrice: 15, sellingPrice: 28, quantity: 40 },
  { name: 'Vanilla Air Freshener', category: 'Automotive', buyingPrice: 3, sellingPrice: 6, quantity: 150 },
  { name: 'Ceramic Brake Pads', category: 'Automotive', buyingPrice: 40, sellingPrice: 70, quantity: 30 },
  { name: 'Iridium Spark Plugs', category: 'Automotive', buyingPrice: 8, sellingPrice: 15, quantity: 80 },
  { name: 'Fast Charge Car Charger', category: 'Automotive', buyingPrice: 12, sellingPrice: 22, quantity: 70 },
  { name: 'All-Weather Floor Mats', category: 'Automotive', buyingPrice: 18, sellingPrice: 32, quantity: 45 },
  { name: 'Professional Tool Kit', category: 'Automotive', buyingPrice: 35, sellingPrice: 60, quantity: 25 },
  { name: 'Heavy Duty Jump Cables', category: 'Automotive', buyingPrice: 22, sellingPrice: 40, quantity: 35 },
  { name: 'Rain-X Windshield Wipers', category: 'Automotive', buyingPrice: 15, sellingPrice: 28, quantity: 50 },

  // Toys (12 products)
  { name: 'Marvel Action Figure', category: 'Toys', buyingPrice: 12, sellingPrice: 22, quantity: 80 },
  { name: 'Barbie Fashion Doll', category: 'Toys', buyingPrice: 15, sellingPrice: 28, quantity: 60 },
  { name: 'Monopoly Board Game', category: 'Toys', buyingPrice: 20, sellingPrice: 35, quantity: 40 },
  { name: '1000 Piece Puzzle', category: 'Toys', buyingPrice: 8, sellingPrice: 15, quantity: 90 },
  { name: 'LEGO Classic Set', category: 'Toys', buyingPrice: 25, sellingPrice: 45, quantity: 35 },
  { name: 'RC Drift Car', category: 'Toys', buyingPrice: 40, sellingPrice: 70, quantity: 20 },
  { name: 'Giant Teddy Bear', category: 'Toys', buyingPrice: 10, sellingPrice: 18, quantity: 100 },
  { name: 'Crayola Art Set', category: 'Toys', buyingPrice: 12, sellingPrice: 22, quantity: 75 },
  { name: 'Soccer Ball Size 5', category: 'Toys', buyingPrice: 5, sellingPrice: 10, quantity: 120 },
  { name: 'Diamond Kite', category: 'Toys', buyingPrice: 6, sellingPrice: 12, quantity: 50 },
  { name: 'Electric Train Set', category: 'Toys', buyingPrice: 30, sellingPrice: 55, quantity: 25 },
  { name: 'Kids Piano Keyboard', category: 'Toys', buyingPrice: 35, sellingPrice: 60, quantity: 18 },

  // Office Supplies (12 products)
  { name: 'Ballpoint Pen Blue', category: 'Office Supplies', buyingPrice: 1, sellingPrice: 2, quantity: 500 },
  { name: 'HB Pencil Pack', category: 'Office Supplies', buyingPrice: 0.5, sellingPrice: 1, quantity: 600 },
  { name: 'A4 Ruled Notebook', category: 'Office Supplies', buyingPrice: 3, sellingPrice: 6, quantity: 200 },
  { name: 'Heavy Duty Stapler', category: 'Office Supplies', buyingPrice: 8, sellingPrice: 15, quantity: 50 },
  { name: 'Colored Paper Clips', category: 'Office Supplies', buyingPrice: 2, sellingPrice: 4, quantity: 300 },
  { name: 'Metal Ruler 30cm', category: 'Office Supplies', buyingPrice: 2, sellingPrice: 4, quantity: 150 },
  { name: 'Permanent Marker Set', category: 'Office Supplies', buyingPrice: 2, sellingPrice: 4, quantity: 250 },
  { name: 'Pink Pearl Eraser', category: 'Office Supplies', buyingPrice: 1, sellingPrice: 2, quantity: 400 },
  { name: 'Manila File Folder', category: 'Office Supplies', buyingPrice: 3, sellingPrice: 6, quantity: 180 },
  { name: 'Scientific Calculator', category: 'Office Supplies', buyingPrice: 15, sellingPrice: 28, quantity: 40 },
  { name: 'Precision Scissors', category: 'Office Supplies', buyingPrice: 5, sellingPrice: 10, quantity: 80 },
  { name: 'Clear Packaging Tape', category: 'Office Supplies', buyingPrice: 3, sellingPrice: 6, quantity: 120 }
];

export default function BulkCreateProducts() {
  const [isCreating, setIsCreating] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);
  const [results, setResults] = useState<Array<{ name: string; success: boolean; error?: string }>>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);

  const createProductMutation = useMutation({
    mutationFn: async (product: any) => {
      const response = await apiRequest("POST", ENDPOINTS.products.create, product);
      return response;
    },
  });

  const handleBulkCreate = async () => {
    setIsCreating(true);
    setCurrentProduct(0);
    setSuccessCount(0);
    setFailureCount(0);
    setResults([]);

    // Get admin data from localStorage
    const adminDataStr = localStorage.getItem('adminData');
    if (!adminDataStr) {
      toast({
        title: "Error",
        description: "Admin data not found. Please log in again.",
        variant: "destructive",
      });
      setIsCreating(false);
      return;
    }

    const adminData = JSON.parse(adminDataStr);
    const attendantId = adminData.attendantId?._id || adminData._id;
    const shopId = selectedShopId || String(extractId(adminData?.primaryShop) ?? '');

    for (let i = 0; i < productTemplates.length; i++) {
      const template = productTemplates[i];
      setCurrentProduct(i + 1);

      const product = {
        name: template.name,
        categoryId: template.category,
        buyingPrice: template.buyingPrice,
        sellingPrice: template.sellingPrice,
        quantity: template.quantity,
        barcode: `SKU${String(i + 1).padStart(3, '0')}`,
        description: `Quality ${template.name} - ${template.category}`,
        alertQuantity: Math.floor(template.quantity * 0.2),
        reorderLevel: Math.floor(template.quantity * 0.15),
        measureUnit: 'pcs',
        shopId: shopId
      };

      try {
        await createProductMutation.mutateAsync(product);
        setSuccessCount(prev => prev + 1);
        setResults(prev => [...prev, { name: template.name, success: true }]);
      } catch (error: any) {
        setFailureCount(prev => prev + 1);
        setResults(prev => [...prev, { 
          name: template.name, 
          success: false, 
          error: error.message || 'Failed to create product'
        }]);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Refresh product data
    queryClient.invalidateQueries({ queryKey: [ENDPOINTS.products.getAll] });
    
    setIsCreating(false);
    toast({
      title: "Bulk Creation Complete",
      description: `Created ${successCount} products successfully. ${failureCount} failed.`,
    });
  };

  const progress = productTemplates.length > 0 ? (currentProduct / productTemplates.length) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="p-4 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Bulk Create Products
            </CardTitle>
            <CardDescription>
              Create 120 diverse products across 10 categories for testing stock count functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{productTemplates.length}</div>
                <div className="text-sm text-gray-600">Total Products</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{successCount}</div>
                <div className="text-sm text-gray-600">Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{failureCount}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{currentProduct}</div>
                <div className="text-sm text-gray-600">Current</div>
              </div>
            </div>

            {isCreating && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Creating products...</span>
                  <span>{currentProduct}/{productTemplates.length}</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            <div className="flex justify-center">
              <Button
                onClick={handleBulkCreate}
                disabled={isCreating}
                className="bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isCreating ? `Creating... (${currentProduct}/${productTemplates.length})` : 'Create 120 Products'}
              </Button>
            </div>

            {results.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <h3 className="font-medium">Creation Results:</h3>
                {results.map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{result.name}</span>
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-sm text-gray-600">
              <h4 className="font-medium mb-2">Product Categories (12 each):</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Badge variant="outline">Electronics</Badge>
                <Badge variant="outline">Groceries</Badge>
                <Badge variant="outline">Clothing</Badge>
                <Badge variant="outline">Home & Garden</Badge>
                <Badge variant="outline">Sports</Badge>
                <Badge variant="outline">Books</Badge>
                <Badge variant="outline">Health & Beauty</Badge>
                <Badge variant="outline">Automotive</Badge>
                <Badge variant="outline">Toys</Badge>
                <Badge variant="outline">Office Supplies</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}