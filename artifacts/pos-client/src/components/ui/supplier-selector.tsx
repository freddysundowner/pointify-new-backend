import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { Input } from "./input";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { useAuth } from "../../features/auth/useAuth";
import { useToast } from "../../hooks/use-toast";
import { apiRequest } from "../../lib/queryClient";
import { ENDPOINTS } from "../../lib/api-endpoints";

interface SupplierSelectorProps {
  selectedSuppliers: string[];
  onToggleSupplier: (supplierId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function SupplierSelector({
  selectedSuppliers,
  onToggleSupplier,
  isOpen,
  onClose
}: SupplierSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    phoneNumber: ""
  });
  
  const { admin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get shop ID from auth context
  const getShopId = (primaryShop: any) => {
    if (!primaryShop) return "";
    return primaryShop._id || primaryShop.id || "";
  };

  const shopId = getShopId(admin?.primaryShop);

  // Fetch suppliers from API
  const { data: suppliersResponse, isLoading, error } = useQuery({
    queryKey: [ENDPOINTS.suppliers.getAllSingular, shopId],
    enabled: !!shopId && isOpen,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const suppliers = Array.isArray(suppliersResponse) ? suppliersResponse : 
                   (suppliersResponse as any)?.data || [];

  // Filter suppliers based on search query
  // Create supplier mutation
  const createSupplierMutation = useMutation({
    mutationFn: async (supplierData: { name: string; shopId: string; phoneNumber: string }) => {
      const response = await fetch(ENDPOINTS.suppliers.getAllSingular, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(supplierData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to create supplier');
      }
      
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: "Supplier created successfully"
      });
      // Refresh suppliers list
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.suppliers.getAllSingular, shopId] });
      // Reset form
      setNewSupplier({ name: "", phoneNumber: "" });
      setShowAddForm(false);
      // Auto-select the new supplier if it has an ID
      if (data?._id) {
        onToggleSupplier(data._id);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create supplier",
        variant: "destructive"
      });
    }
  });

  const handleCreateSupplier = () => {
    if (!newSupplier.name.trim() || !newSupplier.phoneNumber.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    createSupplierMutation.mutate({
      name: newSupplier.name.trim(),
      shopId,
      phoneNumber: newSupplier.phoneNumber.trim()
    });
  };

  const filteredSuppliers = suppliers.filter((supplier: any) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      supplier.name?.toLowerCase().includes(query) ||
      supplier.email?.toLowerCase().includes(query) ||
      supplier.phone?.toLowerCase().includes(query) ||
      supplier.company?.toLowerCase().includes(query)
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Suppliers</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search Input and Add Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search suppliers by name, email, phone, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddForm(!showAddForm)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add New
            </Button>
          </div>

          {/* Add Supplier Form */}
          {showAddForm && (
            <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Add New Supplier</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Supplier name"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                />
                <Input
                  placeholder="Phone number"
                  value={newSupplier.phoneNumber}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phoneNumber: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateSupplier}
                  disabled={createSupplierMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {createSupplierMutation.isPending ? "Creating..." : "Create Supplier"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewSupplier({ name: "", phoneNumber: "" });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          
          {/* Supplier List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {error && (
              <div className="text-center py-2 text-orange-600 text-sm bg-orange-50 border border-orange-200 rounded">
                API temporarily unavailable - please try again
              </div>
            )}
            {isLoading ? (
              <div className="text-center py-4 text-gray-500">Loading suppliers...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                {searchQuery ? "No suppliers found matching your search" : "No suppliers available"}
              </div>
            ) : (
              filteredSuppliers.map((supplier: any) => (
                <div key={supplier._id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium">{supplier.name}</p>
                    <p className="text-sm text-gray-500">
                      {supplier.company && `${supplier.company} • `}
                      {supplier.email && `${supplier.email} • `}
                      {supplier.phone}
                    </p>
                    {supplier.address && (
                      <p className="text-xs text-gray-400">{supplier.address}</p>
                    )}
                  </div>
                  <Checkbox
                    checked={selectedSuppliers && selectedSuppliers.includes(supplier._id)}
                    onCheckedChange={() => onToggleSupplier(supplier._id)}
                  />
                </div>
              ))
            )}
          </div>

          {/* Selected Suppliers Display */}
          {selectedSuppliers && selectedSuppliers.length > 0 && (
            <div className="space-y-3 mt-6">
              <h4 className="text-sm font-medium text-gray-700">
                Selected Suppliers ({selectedSuppliers.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {(selectedSuppliers || []).map((supplierId) => {
                  const supplier = suppliers.find((s: any) => s._id === supplierId);
                  return (
                    <div key={supplierId} className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                      <span>{supplier?.name || `Supplier ${supplierId}`}</span>
                      <button
                        onClick={() => onToggleSupplier(supplierId)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onClose}>
              Done ({selectedSuppliers?.length || 0} selected)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}