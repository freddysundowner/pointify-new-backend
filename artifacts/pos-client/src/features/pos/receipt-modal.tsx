import { Printer, Plus, Check, Download, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Transaction, CartItem } from "@shared/schema";
import { jsPDF } from 'jspdf';
import { useToast } from "@/hooks/use-toast";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useEffect } from "react";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onNewTransaction: () => void;
}

export default function ReceiptModal({ isOpen, onClose, transaction, onNewTransaction }: ReceiptModalProps) {
  if (!transaction) return null;

  const { toast } = useToast();
  const adminData = localStorage.getItem('adminData');
  const admin = adminData ? JSON.parse(adminData) : null;
  const primaryShop = admin?.primaryShop;
  const attendantName = admin?.attendantId?.username || admin?.username || 'Staff';
  const items = transaction.items as CartItem[];
  const transactionDate = new Date();
  const shopTaxRate = primaryShop?.tax || 0;
  const currency = primaryShop?.currency || 'KES';

  const getPrintData = () => ({
    shopName: primaryShop?.name || 'Business Name',
    shopAddress: primaryShop?.address || '',
    receiptNumber: transaction.id.toString(),
    date: transactionDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    currency,
    items: items.map(item => ({ name: item.name, quantity: item.quantity, unitPrice: item.price, total: item.total, serialnumber: item?.serialnumber || '' })),
    subtotal: transaction.subtotal,
    tax: transaction.tax,
    total: transaction.total,
    paymentMethod: transaction.paymentMethod,
    customerName: transaction.customerName || 'Walk-in',
    attendant: attendantName,
    splitPayment: transaction.paymentMethod === 'split' ? { cash: transaction.amountPaid || 0, mpesa: transaction.mpesaTotal || 0, bank: transaction.bankTotal || 0 } : undefined,
  });

  useEffect(() => {
    if (isOpen && transaction && admin?.autoPrint === true) printThermal();
  }, [isOpen, transaction]);

  const printThermal = async (receiptData: any = getPrintData()) => {
    if (receiptData && typeof receiptData.preventDefault === 'function') receiptData = getPrintData();
    if (!receiptData) receiptData = getPrintData();
    try {
      const response = await apiCall(ENDPOINTS.printer.saleReceipt, { method: 'POST', body: JSON.stringify(receiptData) });
      const respo = await response.json();
      if (respo.success) toast({ title: "Receipt Printed" });
    } catch (error) {
      console.log('Thermal printing error:', error);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text(primaryShop?.name || 'Store Name', 105, 20, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    if (primaryShop?.address) doc.text(primaryShop.address, 105, 30, { align: 'center' });
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('SALES RECEIPT', 105, 45, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Receipt #: ${transaction.id}`, 20, 60);
    doc.text(`Date: ${transactionDate.toLocaleDateString()} ${transactionDate.toLocaleTimeString()}`, 20, 67);
    doc.text(`Attendant: ${attendantName}`, 20, 74);
    doc.text(`Customer: ${transaction.customerName || 'Walk-in'}`, 20, 81);
    let yPos = 96;
    doc.setFont('helvetica', 'bold');
    doc.text('Item', 20, yPos); doc.text('Qty', 100, yPos); doc.text('Price', 130, yPos); doc.text('Total', 160, yPos);
    doc.line(20, yPos + 2, 190, yPos + 2);
    yPos += 10; doc.setFont('helvetica', 'normal');
    items.forEach(item => {
      doc.text(item.name.substring(0, 20), 20, yPos);
      doc.text(item.quantity.toString(), 100, yPos);
      doc.text(`${currency} ${item.price.toFixed(2)}`, 130, yPos);
      doc.text(`${currency} ${item.total.toFixed(2)}`, 160, yPos);
      yPos += 8;
    });
    yPos += 5; doc.line(20, yPos, 190, yPos); yPos += 8;
    doc.text(`Subtotal: ${currency} ${transaction.subtotal.toFixed(2)}`, 130, yPos); yPos += 7;
    doc.text(`Tax (${shopTaxRate}%): ${currency} ${transaction.tax.toFixed(2)}`, 130, yPos); yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${currency} ${transaction.total.toFixed(2)}`, 130, yPos); yPos += 12;
    doc.setFont('helvetica', 'normal');
    doc.text(`Payment: ${transaction.paymentMethod}`, 20, yPos); yPos += 15;
    doc.setFontSize(10); doc.text('Thank you for your business!', 105, yPos, { align: 'center' });
    doc.save(`receipt-${transaction.id}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const totalDiscount = items.reduce((sum, item) => sum + ((item.discount || 0) * item.quantity), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm w-full p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-3.5 w-3.5 text-white" />
            </span>
            <span>Transaction Complete</span>
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable receipt body */}
        <div className="overflow-y-auto px-4 pb-2" style={{ maxHeight: 'calc(85vh - 160px)' }}>
          {/* Shop info */}
          <div className="text-center mb-2">
            <p className="font-semibold text-sm text-gray-800">{primaryShop?.name || 'Store Name'}</p>
            {primaryShop?.address && <p className="text-xs text-gray-500">{primaryShop.address}</p>}
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mb-2 pb-2 border-b">
            <span className="text-gray-500">Receipt</span>
            <span className="font-medium text-right">#{transaction.id}</span>
            <span className="text-gray-500">Date</span>
            <span className="font-medium text-right">{transactionDate.toLocaleDateString()} {transactionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-gray-500">Served by</span>
            <span className="font-medium text-right">{attendantName}</span>
            {transaction.customerName && (
              <>
                <span className="text-gray-500">Customer</span>
                <span className="font-medium text-right">{transaction.customerName}</span>
              </>
            )}
          </div>

          {/* Items */}
          <div className="space-y-1 mb-2 pb-2 border-b">
            {items.map((item, index) => (
              <div key={`${item.id}-${index}`}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium truncate max-w-[55%]">{item.name} <span className="text-gray-400 font-normal">×{item.quantity}</span></span>
                  <span className="font-semibold">{currency} {Number(item.total).toFixed(2)}</span>
                </div>
                {item.discount && Number(item.discount) > 0 ? (
                  <div className="flex justify-between text-xs text-green-600 pl-2">
                    <span>Discount</span>
                    <span>-{currency} {(Number(item.discount) * Number(item.quantity)).toFixed(2)}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-0.5 text-xs mb-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{currency} {Number(transaction.subtotal).toFixed(2)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{currency} {totalDiscount.toFixed(2)}</span>
              </div>
            )}
            {Number(transaction.tax) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax ({shopTaxRate}%)</span>
                <span>{currency} {Number(transaction.tax).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-1 border-t mt-1">
              <span>Total</span>
              <span className="text-primary">{currency} {Number(transaction.total).toFixed(2)}</span>
            </div>

            {/* Payment */}
            {transaction.paymentMethod === 'split' ? (
              <div className="pt-1 border-t space-y-0.5">
                <p className="font-medium text-gray-600">Payment Breakdown</p>
                {transaction.amountPaid > 0 && <div className="flex justify-between"><span className="text-gray-500">Cash</span><span>{currency} {Number(transaction.amountPaid).toFixed(2)}</span></div>}
                {(transaction as any).mpesaNewTotal > 0 && <div className="flex justify-between"><span className="text-gray-500">M-Pesa</span><span>{currency} {Number((transaction as any).mpesaNewTotal).toFixed(2)}</span></div>}
                {(transaction as any).bankTotal > 0 && <div className="flex justify-between"><span className="text-gray-500">Bank</span><span>{currency} {Number((transaction as any).bankTotal).toFixed(2)}</span></div>}
              </div>
            ) : (
              <div className="flex justify-between text-gray-600 pt-1">
                <span>Payment</span>
                <span className="capitalize font-medium">{transaction.paymentMethod}</span>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 pb-1">Thank you for your business!</p>
        </div>

        {/* Sticky action footer */}
        <div className="px-4 pb-4 pt-2 border-t bg-white space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={printThermal}>
              <Printer className="mr-1 h-3 w-3" /> Print
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={generatePDF}>
              <Download className="mr-1 h-3 w-3" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              <Mail className="mr-1 h-3 w-3" /> Email
            </Button>
          </div>
          <Button onClick={onNewTransaction} size="sm" className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-sm font-semibold">
            <Plus className="mr-1 h-4 w-4" /> New Transaction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
