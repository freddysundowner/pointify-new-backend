import { useQuery } from "@tanstack/react-query";
import { ENDPOINTS } from "@/lib/api-endpoints";

export interface ShopDetails {
  name: string;
  address: string;
  phone: string;
  email: string;
}

function getToken(): string {
  return localStorage.getItem("authToken") || localStorage.getItem("attendantToken") || "";
}

export function useShopDetails(shopId: string | number | null | undefined): ShopDetails {
  const id = shopId ? String(shopId) : "";

  const { data } = useQuery<any>({
    queryKey: ["shop-detail-pdf", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(ENDPOINTS.shop.getById(id), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return null;
      const result = await res.json();
      return result?.data ?? result;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    name: data?.name || "",
    address: data?.address || data?.receiptAddress || "",
    phone: data?.contact || data?.phone || "",
    email: data?.receiptEmail || data?.email || "",
  };
}

export function drawShopHeader(
  doc: any,
  shop: ShopDetails,
  reportTitle: string,
  subtitle?: string,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const isPortrait = pageW < 250;
  const cx = pageW / 2;

  let y = isPortrait ? 14 : 12;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text((shop.name || "Shop").toUpperCase(), cx, y, { align: "center" });
  y += isPortrait ? 7 : 6;

  if (shop.address) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(shop.address, cx, y, { align: "center" });
    y += 5;
  }

  if (shop.phone) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Tel: ${shop.phone}`, cx, y, { align: "center" });
    y += 5;
  }

  if (shop.email) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(shop.email, cx, y, { align: "center" });
    y += 5;
  }

  y += 2;
  doc.setLineWidth(0.3);
  doc.line(14, y, pageW - 14, y);
  y += 5;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(reportTitle.toUpperCase(), cx, y, { align: "center" });
  y += 6;

  if (subtitle) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, cx, y, { align: "center" });
    y += 5;
  }

  y += 3;
  return y;
}
