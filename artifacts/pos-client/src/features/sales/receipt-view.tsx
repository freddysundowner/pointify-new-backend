import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Mail, Printer, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useRoute, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { apiCall } from "@/lib/api-config";
import { toast } from "@/hooks/use-toast";

export default function ReceiptView() {
  const [adminMatch, adminParams] = useRoute("/receipt/:id");
  const [attendantMatch, attendantParams] = useRoute("/attendant/receipt/:id");

  const match = adminMatch || attendantMatch;
  const params = adminParams || attendantParams;
  const saleId = params?.id;

  const adminData = localStorage.getItem("adminData");
  const admin = adminData ? JSON.parse(adminData) : null;
  const primaryShop = admin?.primaryShop;

  const [sale, setSale] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (!saleId) {
      setError("Sale ID is required");
      setIsLoading(false);
      return;
    }

    const passedData = (window as any).__receiptData;
    if (passedData && passedData._id === saleId) {
      setSale(passedData);
      setIsLoading(false);
      delete (window as any).__receiptData;
      return;
    }

    const fetchSaleData = async () => {
      try {
        const response = await fetch(`/api/sales/single/receipt/${saleId}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to fetch sale data");
        const data = await response.json();
        setSale(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch sale data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSaleData();
  }, [saleId]);

  if (isLoading) {
    return (
      <DashboardLayout title="Loading Receipt...">
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading receipt details...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !sale) {
    return (
      <DashboardLayout title="Receipt Not Found">
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Receipt Not Found</h1>
          <p className="text-gray-600">The requested receipt could not be found.</p>
          <Button className="mt-4" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const saleData = {
    id: sale._id || sale.id,
    receiptNo: sale.receiptNo || sale._id,
    customerName: sale.customerId?.name || "Walk-in",
    totalAmount: sale.totalAmount || 0,
    totalWithDiscount: sale.totalWithDiscount || sale.totalAmount || 0,
    totaltax: sale.totaltax || 0,
    saleDiscount: sale.saleDiscount || 0,
    saleDate: sale.createdAt || sale.saleDate,
    status: sale.status === "cashed" ? "COMPLETED" : (sale.status || "").toUpperCase(),
    paymentTag: sale.paymentTag || sale.paymentType || "cash",
    saleType: sale.saleType || "Retail",
    salesnote: sale.salesnote || "",
    items: (sale.items || []).map((item: any) => ({
      productName: item.product?.name || item.productName || "Unknown Product",
      quantity: item.quantity || 0,
      unitPrice: item.unitPrice || 0,
      lineDiscount: item.lineDiscount || 0,
      totalPrice: (item.quantity || 0) * (item.unitPrice || 0),
    })),
    attendantName: sale.attendantId?.username || "Unknown",
    amountPaid: sale.amountPaid || 0,
    outstandingBalance: sale.outstandingBalance || 0,
    mpesaTotal: sale.mpesaTotal || sale.mpesaNewTotal || 0,
    bankTotal: sale.bankTotal || 0,
    mpesaTransId: sale.mpesaTransId || "",
    bankTransId: sale.bankTransId || "",
    shop: {
      name: sale.shopId?.name || sale.shopId?.shopName || primaryShop?.name || "Shop",
      address: sale.shopId?.address || primaryShop?.address || "",
      address_receipt: sale.shopId?.address_receipt || primaryShop?.address_receipt || "",
      contact: sale.shopId?.contact || sale.shopId?.phone || primaryShop?.contact || "",
      receiptemail: sale.shopId?.receiptemail || sale.shopId?.email || primaryShop?.receiptemail || "",
      paybill_account: sale.shopId?.paybill_account || primaryShop?.paybill_account || "",
      paybill_till: sale.shopId?.paybill_till || primaryShop?.paybill_till || "",
      currency: sale.shopId?.currency || primaryShop?.currency || "KES",
    },
  };

  const currency = saleData.shop.currency;
  const fmt = (n: number) => `${currency} ${Number(n).toFixed(2)}`;
  const subtotal = saleData.items.reduce((s: number, i: any) => s + i.totalPrice, 0);
  const itemDiscounts = saleData.items.reduce((s: number, i: any) => s + (i.lineDiscount || 0), 0);
  const date = new Date(saleData.saleDate);

  const getPrintData = () => ({
    shopName: saleData.shop.name,
    shopAddress: saleData.shop.address,
    receiptNumber: saleData.receiptNo?.toString(),
    date: `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
    currency,
    items: saleData.items.map((item: any) => ({
      name: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.totalPrice,
    })),
    subtotal,
    tax: saleData.totaltax,
    total: saleData.totalWithDiscount,
    paymentMethod: saleData.paymentTag,
    customerName: saleData.customerName,
    attendant: saleData.attendantName,
    splitPayment:
      saleData.paymentTag === "split"
        ? { cash: saleData.amountPaid, mpesa: saleData.mpesaTotal, bank: saleData.bankTotal }
        : "",
  });

  const getReceiptHtml = () => `<!DOCTYPE html><html><head><title>Receipt #${saleData.receiptNo}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Courier New',Courier,monospace;margin:0;background:#f5f5f5;display:flex;justify-content:center;padding:20px}
  .receipt{background:#fff;width:320px;padding:20px 24px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
  .center{text-align:center}.bold{font-weight:bold}.small{font-size:11px}
  .divider{border:none;border-top:1px dashed #999;margin:8px 0}
  .row{display:flex;justify-content:space-between;font-size:12px;margin:3px 0}
  .total-row{display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin:4px 0}
  .item-name{font-size:12px;margin:4px 0 1px}
  .item-detail{display:flex;justify-content:space-between;font-size:12px;padding-left:8px;color:#444}
  @media print{body{background:#fff;padding:0}.receipt{box-shadow:none;width:100%}}
</style>
</head><body><div class="receipt">
<div class="center bold" style="font-size:15px;text-transform:uppercase">${saleData.shop.name}</div>
${saleData.shop.address ? `<div class="center small">${saleData.shop.address}</div>` : ""}
${saleData.shop.address_receipt ? `<div class="center small">${saleData.shop.address_receipt}</div>` : ""}
${saleData.shop.contact ? `<div class="center small">Tel: ${saleData.shop.contact}</div>` : ""}
${saleData.shop.receiptemail ? `<div class="center small">${saleData.shop.receiptemail}</div>` : ""}
${saleData.shop.paybill_account ? `<div class="center small">Paybill: ${saleData.shop.paybill_account}${saleData.shop.paybill_till ? ` / Acc: ${saleData.shop.paybill_till}` : ""}</div>` : ""}
${!saleData.shop.paybill_account && saleData.shop.paybill_till ? `<div class="center small">Buy Goods: ${saleData.shop.paybill_till}</div>` : ""}
<hr class="divider">
<div class="center bold" style="letter-spacing:2px">SALES RECEIPT</div>
<hr class="divider">
<div class="row"><span>Receipt #:</span><span>${saleData.receiptNo}</span></div>
<div class="row"><span>Date:</span><span>${date.toLocaleDateString()}</span></div>
<div class="row"><span>Time:</span><span>${date.toLocaleTimeString()}</span></div>
<div class="row"><span>Customer:</span><span>${saleData.customerName}</span></div>
<div class="row"><span>Cashier:</span><span>${saleData.attendantName}</span></div>
<div class="row"><span>Type:</span><span>${saleData.saleType}</span></div>
<hr class="divider">
<div style="display:flex;font-weight:bold;font-size:11px;margin-bottom:4px">
  <span style="flex:1">ITEM</span><span style="width:30px;text-align:center">QTY</span>
  <span style="width:55px;text-align:right">PRICE</span><span style="width:55px;text-align:right">TOTAL</span>
</div>
<hr class="divider" style="margin-top:2px">
${saleData.items.map((item: any) => `
<div style="display:flex;font-size:12px;margin:3px 0">
  <span style="flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${item.productName}</span>
  <span style="width:30px;text-align:center">${item.quantity}</span>
  <span style="width:55px;text-align:right">${item.unitPrice.toFixed(2)}</span>
  <span style="width:55px;text-align:right;font-weight:600">${item.totalPrice.toFixed(2)}</span>
</div>
${item.lineDiscount > 0 ? `<div class="row" style="color:#888;font-size:11px;padding-left:8px"><span>Discount</span><span>-${item.lineDiscount.toFixed(2)}</span></div>` : ""}
`).join("")}
<hr class="divider">
<div class="row"><span>Subtotal:</span><span>${fmt(subtotal)}</span></div>
${itemDiscounts > 0 ? `<div class="row"><span>Item Discounts:</span><span>-${fmt(itemDiscounts)}</span></div>` : ""}
${saleData.saleDiscount > 0 ? `<div class="row"><span>Sale Discount:</span><span>-${fmt(saleData.saleDiscount)}</span></div>` : ""}
${saleData.totaltax > 0 ? `<div class="row"><span>Tax:</span><span>${fmt(saleData.totaltax)}</span></div>` : ""}
<hr class="divider">
<div class="total-row"><span>TOTAL</span><span>${fmt(saleData.totalWithDiscount)}</span></div>
<hr class="divider">
<div class="row"><span>Payment:</span><span>${saleData.paymentTag.toUpperCase()}</span></div>
${saleData.paymentTag === "split" ? `
${saleData.amountPaid > 0 ? `<div class="row" style="padding-left:8px"><span>Cash:</span><span>${fmt(saleData.amountPaid)}</span></div>` : ""}
${saleData.mpesaTotal > 0 ? `<div class="row" style="padding-left:8px"><span>M-Pesa:</span><span>${fmt(saleData.mpesaTotal)}</span></div>` : ""}
${saleData.bankTotal > 0 ? `<div class="row" style="padding-left:8px"><span>Bank:</span><span>${fmt(saleData.bankTotal)}</span></div>` : ""}
` : ""}
${saleData.outstandingBalance > 0 && saleData.status.toUpperCase() !== "COMPLETED" ? `<div class="row" style="font-weight:bold;color:#c00"><span>Balance Due:</span><span>${fmt(saleData.outstandingBalance)}</span></div>` : ""}
<div class="row"><span>Status:</span><span>${saleData.status}</span></div>
<hr class="divider">
<div style="display:flex;justify-content:center;margin:12px 0">
  <div style="border:2px solid ${saleData.status.toUpperCase() === "COMPLETED" ? "#16a34a" : "#dc2626"};border-radius:4px;padding:4px 20px;font-weight:bold;letter-spacing:3px;font-size:14px;color:${saleData.status.toUpperCase() === "COMPLETED" ? "#16a34a" : "#dc2626"};transform:rotate(-12deg);display:inline-block">
    ${saleData.status.toUpperCase() === "COMPLETED" ? "PAID" : "UNPAID"}
  </div>
</div>
<div class="center small" style="margin-top:12px">Thank you for your business!</div>
<div class="center" style="font-size:10px;color:#aaa;margin-top:4px">store.pointifypos.com</div>
</div></body></html>`;

  const openReceiptWindow = (autoPrint: boolean) => {
    const printWindow = window.open("", "_blank", "width=1000,height=900");
    if (!printWindow) return;
    printWindow.document.write(getReceiptHtml());
    printWindow.document.close();
    if (autoPrint) {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 600);
    }
  };

  const handlePrint = async () => {
    try {
      const response = await apiCall("/api/printer/salereceipt", {
        method: "POST",
        body: JSON.stringify(getPrintData()),
      });
      const res = await response.json();
      if (res.success) {
        toast({ title: "Receipt Printed" });
      } else {
        openReceiptWindow(true);
      }
    } catch {
      openReceiptWindow(true);
    }
  };

  const handleDownload = () => {
    openReceiptWindow(false);
  };

  const handleEmail = () => {
    setEmailInput(saleData.customerEmail || "");
    setEmailSent(false);
    setShowEmailDialog(true);
  };

  const generateReceiptPdfBase64 = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-9999px";
      iframe.style.top = "0";
      iframe.style.width = "380px";
      iframe.style.height = "1200px";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      iframe.onload = async () => {
        try {
          await new Promise((r) => setTimeout(r, 300));
          const html2canvas = (await import("html2canvas")).default;
          const { jsPDF } = await import("jspdf");

          const receiptEl = iframe.contentDocument?.querySelector(".receipt") as HTMLElement;
          if (!receiptEl) throw new Error("Receipt element not found");

          const canvas = await html2canvas(receiptEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
          });

          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          const widthMm = 80;
          const heightMm = (canvas.height * widthMm) / canvas.width;

          const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: [widthMm + 10, heightMm + 10],
          });
          doc.addImage(imgData, "JPEG", 5, 5, widthMm, heightMm);

          const base64 = doc.output("datauristring").split(",")[1];
          resolve(base64);
        } catch (err) {
          reject(err);
        } finally {
          document.body.removeChild(iframe);
        }
      };

      iframe.srcdoc = getReceiptHtml();
    });
  };

  const handleSendEmail = async () => {
    if (!emailInput.trim()) return;
    setIsSendingEmail(true);
    try {
      let pdfBase64 = "";
      try {
        pdfBase64 = await generateReceiptPdfBase64();
      } catch (pdfErr) {
        console.warn("PDF generation failed, sending HTML only:", pdfErr);
      }

      const response = await apiCall("/api/sales/email-receipt", {
        method: "POST",
        body: JSON.stringify({
          toEmail: emailInput.trim(),
          receiptHtml: getReceiptHtml(),
          receiptNo: saleData.receiptNo,
          shopName: saleData.shop.name,
          shopEmail: saleData.shop.receiptemail || "",
          customerName: saleData.customerName,
          pdfBase64,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setEmailSent(true);
      } else {
        toast({ title: "Failed to send", description: result.error || "Unknown error", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message || "Network error", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const isSplit = saleData.paymentTag === "split";

  return (
    <DashboardLayout title={`Receipt #${saleData.receiptNo}`}>
      <div className="p-4 md:p-6">
        {/* Action bar */}
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleEmail}>
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        {/* Receipt paper */}
        <div className="flex justify-center print:block">
          <div
            className="bg-white w-full max-w-sm shadow-lg print:shadow-none receipt-content"
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            {/* Jagged top edge */}
            <div
              className="w-full h-4 bg-gray-100 print:bg-white"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 0%, white 10px, transparent 0), radial-gradient(circle at 50% 100%, #f3f4f6 10px, transparent 0)",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 0 0",
              }}
            />

            <div className="px-6 pb-6">
              {/* Shop header */}
              <div className="text-center mb-4 mt-2">
                <div className="font-bold text-base uppercase tracking-wide">
                  {saleData.shop.name}
                </div>
                {saleData.shop.address && (
                  <div className="text-xs text-gray-600 mt-0.5">{saleData.shop.address}</div>
                )}
                {saleData.shop.address_receipt && (
                  <div className="text-xs text-gray-600">{saleData.shop.address_receipt}</div>
                )}
                {saleData.shop.contact && (
                  <div className="text-xs text-gray-600">Tel: {saleData.shop.contact}</div>
                )}
                {saleData.shop.receiptemail && (
                  <div className="text-xs text-gray-600">{saleData.shop.receiptemail}</div>
                )}
                {saleData.shop.paybill_account && (
                  <div className="text-xs text-gray-600">
                    Paybill: {saleData.shop.paybill_account}
                    {saleData.shop.paybill_till && ` / Acc: ${saleData.shop.paybill_till}`}
                  </div>
                )}
                {!saleData.shop.paybill_account && saleData.shop.paybill_till && (
                  <div className="text-xs text-gray-600">
                    Buy Goods: {saleData.shop.paybill_till}
                  </div>
                )}
              </div>

              <Dashes />

              <div className="text-center font-bold text-sm tracking-widest mb-1">
                SALES RECEIPT
              </div>

              <Dashes />

              {/* Meta */}
              <div className="text-xs space-y-1 mb-2">
                <ReceiptRow label="Receipt #" value={saleData.receiptNo} />
                <ReceiptRow label="Date" value={date.toLocaleDateString()} />
                <ReceiptRow label="Time" value={date.toLocaleTimeString()} />
                <ReceiptRow label="Customer" value={saleData.customerName} />
                <ReceiptRow label="Cashier" value={saleData.attendantName} />
                <ReceiptRow label="Type" value={saleData.saleType} />
                {saleData.salesnote && saleData.salesnote !== "HOLD TRANSACTION" && (
                  <ReceiptRow label="Note" value={saleData.salesnote} />
                )}
              </div>

              <Dashes />

              {/* Items header */}
              <div className="flex text-xs font-bold mb-1">
                <span className="flex-1">ITEM</span>
                <span className="w-8 text-center">QTY</span>
                <span className="w-16 text-right">PRICE</span>
                <span className="w-16 text-right">TOTAL</span>
              </div>
              <div
                className="border-t border-dashed border-gray-400 mb-1"
                style={{ borderTopStyle: "dashed" }}
              />

              {/* Items */}
              <div className="space-y-1 mb-2">
                {saleData.items.map((item: any, idx: number) => (
                  <div key={idx}>
                    <div className="flex text-xs">
                      <span className="flex-1 truncate pr-1">{item.productName}</span>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <span className="w-16 text-right">{item.unitPrice.toFixed(2)}</span>
                      <span className="w-16 text-right font-medium">
                        {item.totalPrice.toFixed(2)}
                      </span>
                    </div>
                    {item.lineDiscount > 0 && (
                      <div className="flex text-xs text-gray-500 pl-2">
                        <span className="flex-1">Discount</span>
                        <span className="w-16 text-right">-{item.lineDiscount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Dashes />

              {/* Totals */}
              <div className="text-xs space-y-1 mb-2">
                <ReceiptRow label="Subtotal" value={fmt(subtotal)} />
                {itemDiscounts > 0 && (
                  <ReceiptRow label="Item Discounts" value={`-${fmt(itemDiscounts)}`} />
                )}
                {saleData.saleDiscount > 0 && (
                  <ReceiptRow label="Sale Discount" value={`-${fmt(saleData.saleDiscount)}`} />
                )}
                {saleData.totaltax > 0 && (
                  <ReceiptRow label="Tax" value={fmt(saleData.totaltax)} />
                )}
              </div>

              <Dashes />

              <div className="flex justify-between font-bold text-sm my-2">
                <span>TOTAL</span>
                <span>{fmt(saleData.totalWithDiscount)}</span>
              </div>

              <Dashes />

              {/* Payment */}
              <div className="text-xs space-y-1 mb-2">
                <ReceiptRow label="Payment" value={saleData.paymentTag.toUpperCase()} />
                {isSplit && (
                  <>
                    {saleData.amountPaid > 0 && (
                      <ReceiptRow label="  Cash" value={fmt(saleData.amountPaid)} />
                    )}
                    {saleData.mpesaTotal > 0 && (
                      <ReceiptRow label="  M-Pesa" value={fmt(saleData.mpesaTotal)} />
                    )}
                    {saleData.bankTotal > 0 && (
                      <ReceiptRow label="  Bank" value={fmt(saleData.bankTotal)} />
                    )}
                  </>
                )}
                {!isSplit && saleData.paymentTag === "mpesa" && saleData.mpesaTransId && (
                  <ReceiptRow label="M-Pesa Ref" value={saleData.mpesaTransId} />
                )}
                {!isSplit && saleData.paymentTag === "bank" && saleData.bankTransId && (
                  <ReceiptRow label="Bank Ref" value={saleData.bankTransId} />
                )}
                {saleData.outstandingBalance > 0 && saleData.status.toUpperCase() !== "COMPLETED" && (
                  <ReceiptRow
                    label="Balance Due"
                    value={fmt(saleData.outstandingBalance)}
                    valueClass="font-bold text-red-600"
                  />
                )}
                <ReceiptRow label="Status" value={saleData.status} />
              </div>

              <Dashes />

              {/* PAID / UNPAID stamp */}
              <div className="flex justify-center my-3">
                <div
                  className={`border-2 rounded px-6 py-1 text-sm font-bold tracking-widest ${
                    saleData.status.toUpperCase() === "COMPLETED"
                      ? "border-green-500 text-green-600"
                      : "border-red-500 text-red-600"
                  }`}
                  style={{ transform: "rotate(-12deg)" }}
                >
                  {saleData.status.toUpperCase() === "COMPLETED" ? "PAID" : "UNPAID"}
                </div>
              </div>

              {/* Footer */}
              <div className="text-center mt-3 space-y-0.5">
                <div className="text-xs text-gray-600">Thank you for your business!</div>
                <div className="text-xs text-gray-400">store.pointifypos.com</div>
              </div>
            </div>

            {/* Jagged bottom edge */}
            <div
              className="w-full h-4 bg-gray-100 print:bg-white"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 100%, white 10px, transparent 0), radial-gradient(circle at 50% 0%, #f3f4f6 10px, transparent 0)",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 100%, 0 100%",
              }}
            />
          </div>
        </div>
      </div>

      {/* Email Receipt Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={(open) => { if (!open) { setShowEmailDialog(false); setEmailSent(false); } }}>
        <DialogContent className="max-w-sm">
          {emailSent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Email Sent!</h2>
                <p className="text-sm text-gray-500 mt-1">Receipt has been sent to <span className="font-medium text-gray-700">{emailInput}</span></p>
              </div>
              <Button className="w-full mt-2" onClick={() => { setShowEmailDialog(false); setEmailSent(false); }}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-500" />
                  Email Receipt
                </DialogTitle>
              </DialogHeader>
              <div className="py-2 space-y-3">
                <p className="text-sm text-gray-600">
                  Send receipt <span className="font-medium">#{saleData.receiptNo}</span> to:
                </p>
                <Input
                  type="email"
                  placeholder="customer@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Cancel</Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={!emailInput.trim() || isSendingEmail}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Dashes() {
  return (
    <div className="border-t border-dashed border-gray-400 my-2" />
  );
}

function ReceiptRow({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}:</span>
      <span className={`text-right ${valueClass}`}>{value}</span>
    </div>
  );
}
