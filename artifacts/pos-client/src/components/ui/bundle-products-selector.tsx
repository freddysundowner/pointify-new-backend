import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, X, Search, Plus, Minus, Loader2 } from "lucide-react";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";

interface BundleProductsSelectorProps {
  selectedBundleProducts: { [key: string]: number | { 
    quantity: number; 
    productId: string; 
    inventoryId: string;
    productName?: string;
    sellingPrice?: number;
  } };
  onToggleProduct: (productId: string, productData?: any) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveProduct: (productId: string) => void;
  shopId: string;
  adminId: string;
  existingProducts: any[];
  excludeProductId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function BundleProductsSelector({
  selectedBundleProducts,
  onToggleProduct,
  onUpdateQuantity,
  onRemoveProduct,
  shopId,
  adminId,
  existingProducts,
  excludeProductId,
  isOpen,
  onClose
}: BundleProductsSelectorProps) {
  const [bundleSearchQuery, setBundleSearchQuery] = useState("");
  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);
  const [selectedProductForQuantity, setSelectedProductForQuantity] = useState<any>(null);
  const [quantityInput, setQuantityInput] = useState("1");
  const [apiProducts, setApiProducts] = useState<any[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [searchTimeoutId, setSearchTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Function to search products directly from API
  const searchProductsFromAPI = async (query: string) => {
    setIsLoadingProducts(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "50",
        shopid: shopId,
        sort: "name",
        useWarehouse: "true",
        warehouse: "false",
        adminid: adminId
      });

      // Only add name filter if query is provided
      if (query.trim()) {
        params.set('name', query);
      }

      console.log('Searching products directly from API with query:', query || '(all products)');
      const response = await apiCall(`${ENDPOINTS.products.getAll}?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('API search results:', data?.data?.length || 0, 'products found');
        setApiProducts(data?.data || []);
      } else {
        console.error('Failed to search products from API');
        setApiProducts([]);
      }
    } catch (error) {
      console.error('Error searching products from API:', error);
      setApiProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutId) {
      clearTimeout(searchTimeoutId);
    }

    const timeoutId = setTimeout(() => {
      searchProductsFromAPI(bundleSearchQuery);
    }, 300);

    setSearchTimeoutId(timeoutId);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [bundleSearchQuery, shopId, adminId]);

  // Initial load of products when dialog opens
  useEffect(() => {
    if (isOpen) {
      searchProductsFromAPI(bundleSearchQuery); // Load products when dialog opens
    }
  }, [isOpen]);

  const handleAddProduct = (product: any) => {
    setSelectedProductForQuantity(product);
    setQuantityInput("1");
    setQuantityDialogOpen(true);
  };

  const handleConfirmQuantity = () => {
    if (selectedProductForQuantity && quantityInput && parseInt(quantityInput) > 0) {
      onToggleProduct(selectedProductForQuantity._id, selectedProductForQuantity);
      onUpdateQuantity(selectedProductForQuantity._id, parseInt(quantityInput));
    }
    setQuantityDialogOpen(false);
    setSelectedProductForQuantity(null);
    setQuantityInput("1");
  };

  // Always use API results when available, fallback to cached products only when necessary
  const filteredProducts = (apiProducts.length > 0 || isLoadingProducts || bundleSearchQuery.trim())
    ? apiProducts.filter((product: any) => {
        if (excludeProductId && product._id === excludeProductId) return false;
        return true;
      })
    : existingProducts.filter((product: any) => {
        if (excludeProductId && product._id === excludeProductId) return false;
        return true;
      });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Bundle Products</DialogTitle>
          <p className="text-sm text-muted-foreground">Search for products to include in this bundle. Results show live data including newly created products.</p>
        </DialogHeader>
        
        <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        {isLoadingProducts ? (
          <Loader2 className="absolute left-3 top-3 h-4 w-4 text-gray-400 animate-spin" />
        ) : (
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        )}
        <Input
          placeholder="Search products by name (searches live data)..."
          value={bundleSearchQuery}
          onChange={(e) => setBundleSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {/* Product List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {isLoadingProducts ? (
          <div className="text-center py-4 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Searching products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            {bundleSearchQuery ? "No products found matching your search" : "Start typing to search for products"}
          </div>
        ) : (
          filteredProducts.map((product: any) => (
            <div key={product._id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
              <div className="flex-1">
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-gray-500">
                  {product.sku && `SKU: ${product.sku} • `}
                  Price: ${product.sellingPrice || product.price || 0}
                  {product.category && ` • ${product.category}`}
                </p>
                <p className="text-xs text-gray-400">
                  Stock: {product.quantity || product.stock || 0} units

                </p>
              </div>
              {selectedBundleProducts[product._id] ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRemoveProduct(product._id)}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddProduct(product)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Quantity Input Dialog */}
      <Dialog open={quantityDialogOpen} onOpenChange={setQuantityDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Bundle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedProductForQuantity && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-sm">{selectedProductForQuantity.name}</p>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="quantity" className="text-sm font-medium">
                Quantity
              </label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                placeholder="Enter quantity"
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuantityDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmQuantity}
                disabled={!quantityInput || parseInt(quantityInput) <= 0}
              >
                Add to Bundle
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Selected Products Display */}
      {Object.keys(selectedBundleProducts).length > 0 && (
        <div className="space-y-3 mt-6">
          <h4 className="text-sm font-medium text-gray-700">Selected Bundle Products</h4>
          {Object.entries(selectedBundleProducts).map(([productId, productInfo]) => {
            const product = existingProducts.find((p: any) => p._id === productId);
            const quantity = typeof productInfo === 'number' ? productInfo : productInfo.quantity;
            const productName = typeof productInfo === 'object' && productInfo.productName 
              ? productInfo.productName 
              : product?.name || `Product ${productId}`;
            const price = typeof productInfo === 'object' && productInfo.sellingPrice 
              ? productInfo.sellingPrice 
              : product?.sellingPrice || product?.price || 0;
            
            return (
              <div key={productId} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{productName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => onUpdateQuantity(productId, parseInt(e.target.value) || 1)}
                    className="w-20"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onRemoveProduct(productId)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </div>
        
        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}