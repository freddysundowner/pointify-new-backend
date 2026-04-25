import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { ENDPOINTS } from "@/lib/api-endpoints";

interface SupplierSelectorProps {
  value: string;
  onChange: (value: string) => void;
  shopId: string;
  adminId: string;
}

export default function SupplierSelector({
  value,
  onChange,
  shopId,
  adminId
}: SupplierSelectorProps) {
  // Fetch suppliers from API
  const { data: suppliers, isLoading } = useQuery({
    queryKey: [ENDPOINTS.suppliers.getAll, shopId, adminId],
    queryFn: async () => {
      const params = new URLSearchParams({
        shopId: shopId || "",
        adminId: adminId || "",
      });
      
      const response = await fetch(`${ENDPOINTS.suppliers.getAll}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch suppliers");
      }

      const data = await response.json();
      return Array.isArray(data) ? data : data.data || [];
    },
    enabled: !!(shopId && adminId),
  });

  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger>
        <SelectValue placeholder="Select supplier" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No supplier</SelectItem>
        {isLoading ? (
          <SelectItem value="loading" disabled>
            Loading suppliers...
          </SelectItem>
        ) : (
          suppliers?.map((supplier: any) => (
            <SelectItem key={supplier._id} value={supplier._id}>
              {supplier.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}