import { X, Printer, Mail, Plus, Check, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Transaction, CartItem } from "@shared/schema";
import { jsPDF } from 'jspdf';
import { useToast } from "@/hooks/use-toast";
import { apiCall } from "@/lib/api-config";
import { useEffect, useState } from "react";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onNewTransaction: () => void;
}

export default function ReceiptModal({
  isOpen,
  onClose,
  transaction,
  onNewTransaction,
}: ReceiptModalProps) {
  if (!transaction) return null;
  
  const { toast } = useToast();

  // Get admin and shop data from localStorage
  const adminData = localStorage.getItem('adminData');
  const admin = adminData ? JSON.parse(adminData) : null;
  
  // Primary shop is nested under admin data
  const primaryShop = admin?.primaryShop;
  
  // Get attendant name from attendantId or fallback to admin username
  const attendantName = admin?.attendantId?.username || admin?.username || 'Staff';

  const items = transaction.items as CartItem[];
  const transactionDate = new Date();
  const shopTaxRate = primaryShop?.tax || 0;
  const getPrintData = () => {
    const receiptData = {
        shopName: primaryShop?.name || 'Business Name',
        shopAddress: primaryShop?.address || '',
        receiptNumber: transaction.id.toString(),
        date: transactionDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        currency: primaryShop.currency,
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.total,
          serialnumber: item?.serialnumber || ''
        })),
        subtotal: transaction.subtotal,
        tax: transaction.tax,
        total: transaction.total,
        paymentMethod: transaction.paymentMethod,
        customerName: transaction.customerName || 'Walk-in',
        attendant: attendantName,
        // Handle split payments
        splitPayment: transaction.paymentMethod === 'split' ? {
          cash: transaction.amountPaid || 0,
          mpesa: transaction.mpesaTotal || 0,
          bank: transaction.bankTotal || 0
        } : undefined
      };
      return receiptData;
  }
  useEffect(() => {
  if(isOpen && transaction && admin?.autoPrint === true) {
    printThermal();
  }
}, [isOpen, transaction]);


  // Thermal print function
 const printThermal = async (receiptData = getPrintData()) => {
  console.log('Thermal print data:', receiptData);
  if (receiptData && typeof receiptData.preventDefault === 'function') {
    receiptData = getPrintData();
  }
  if (!receiptData) {
    receiptData = getPrintData();
  }
  try {
    const response = await apiCall('/api/printer/salereceipt', {
      method: 'POST',
      body: JSON.stringify(receiptData)
    });
    const respo = await response.json();
    if (respo.success) {
      toast({
        title: "Receipt Printed",
      });
    } else {
      console.log(respo.message || 'Print failed');
    } 
  } catch (error) {
    console.log('Thermal printing error:', error);
  }
};


  // PDF generation function
  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(primaryShop?.name || 'Store Name', 105, 20, { align: 'center' });
    
    // Shop details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (primaryShop?.address) {
      doc.text(primaryShop.address, 105, 30, { align: 'center' });
    }
    if (primaryShop?.contact) {
      doc.text(`Phone: ${primaryShop.contact}`, 105, 35, { align: 'center' });
    }
    if (primaryShop?.receiptemail) {
      doc.text(`Email: ${primaryShop.receiptemail}`, 105, 40, { align: 'center' });
    }
    
    // Receipt title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SALES RECEIPT', 105, 55, { align: 'center' });
    
    // Receipt details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receipt #: ${transaction.id}`, 20, 70);
    doc.text(`Date: ${transactionDate.toLocaleDateString()}`, 20, 75);
    doc.text(`Time: ${transactionDate.toLocaleTimeString()}`, 20, 80);
    doc.text(`Attendant: ${attendantName}`, 20, 85);
    doc.text(`Customer: ${transaction.customerName || 'Walk-in'}`, 20, 90);
    
    // Items table
    let yPos = 105;
    doc.setFont('helvetica', 'bold');
    doc.text('Item', 20, yPos);
    doc.text('Qty', 100, yPos);
    doc.text('Price', 130, yPos);
    doc.text('Total', 160, yPos);
    
    // Line separator
    doc.setLineWidth(0.5);
    doc.line(20, yPos + 2, 190, yPos + 2);
    
    yPos += 10;
    doc.setFont('helvetica', 'normal');
    
    items.forEach((item) => {
      doc.text(item.name.substring(0, 20), 20, yPos);
      doc.text(item.quantity.toString(), 100, yPos);
      doc.text(`${primaryShop?.currency || 'KES'} ${item.price.toFixed(2)}`, 130, yPos);
      doc.text(`${primaryShop?.currency || 'KES'} ${item.total.toFixed(2)}`, 160, yPos);
      yPos += 8;
    });
    
    // Totals section
    yPos += 10;
    doc.setLineWidth(0.5);
    doc.line(20, yPos, 190, yPos);
    yPos += 10;
    
    doc.text(`Subtotal: ${primaryShop?.currency || 'KES'} ${transaction.subtotal.toFixed(2)}`, 130, yPos);
    yPos += 8;
    doc.text(`Tax (${shopTaxRate}%): ${primaryShop?.currency || 'KES'} ${transaction.tax.toFixed(2)}`, 130, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${primaryShop?.currency || 'KES'} ${transaction.total.toFixed(2)}`, 130, yPos);
    
    // Split payment breakdown
    if (transaction.paymentMethod === 'split') {
      yPos += 15;
      doc.setFont('helvetica', 'bold');
      doc.text('Payment Breakdown:', 20, yPos);
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      
      if ((transaction as any).amountPaid > 0) {
        doc.text(`Cash: ${primaryShop?.currency || 'KES'} ${((transaction as any).amountPaid).toFixed(2)}`, 20, yPos);
        yPos += 6;
      }
      if ((transaction as any).mpesaNewTotal > 0) {
        doc.text(`M-Pesa: ${primaryShop?.currency || 'KES'} ${((transaction as any).mpesaNewTotal).toFixed(2)}`, 20, yPos);
        yPos += 6;
      }
      if ((transaction as any).bankTotal > 0) {
        doc.text(`Bank: ${primaryShop?.currency || 'KES'} ${((transaction as any).bankTotal).toFixed(2)}`, 20, yPos);
        yPos += 6;
      }
    } else {
      yPos += 15;
      doc.setFont('helvetica', 'normal');
      doc.text(`Payment Method: ${transaction.paymentMethod}`, 20, yPos);
    }
    
    // Footer
    yPos += 20;
    doc.setFontSize(10);
    doc.text('Thank you for your business!', 105, yPos, { align: 'center' });
    
    // Save PDF
    const fileName = `receipt-${transaction.id}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full max-h-[90vh] bg-white/95 backdrop-blur-md border-0 shadow-2xl overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold">
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Transaction Complete
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Success Indicator */}
          <div className="text-center py-2">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg">
              <Check className="h-6 w-6 text-white" />
            </div>
            <p className="text-base font-semibold text-gray-800">Payment Successful!</p>
          </div>

          {/* Receipt Content */}
          <div className="bg-white border-2 border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="text-center mb-4 pb-3 border-b border-gray-200">
              <h4 className="font-bold text-lg text-gray-800 mb-1">{primaryShop?.name || 'Store Name'}</h4>
              <p className="text-sm text-gray-600">{primaryShop?.address || 'Store Address'}</p>
              {primaryShop?.address_receipt && (
                <p className="text-sm text-gray-600">{primaryShop.address_receipt}</p>
              )}
              {primaryShop?.contact && (
                <p className="text-sm text-gray-600">Phone: {primaryShop.contact}</p>
              )}
              {primaryShop?.receiptemail && (
                <p className="text-sm text-gray-600">Email: {primaryShop.receiptemail}</p>
              )}
              {(primaryShop?.paybill_account || primaryShop?.paybill_till) && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  {primaryShop?.paybill_account ? (
                    // Show paybill with account number
                    <>
                      <p className="text-xs text-gray-500">Paybill: {primaryShop.paybill_account}</p>
                      {primaryShop?.paybill_till && (
                        <p className="text-xs text-gray-500">Account: {primaryShop.paybill_till}</p>
                      )}
                    </>
                  ) : (
                    // Show only till as Buy Goods
                    primaryShop?.paybill_till && (
                      <p className="text-xs text-gray-500">Buy Goods: {primaryShop.paybill_till}</p>
                    )
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-2 mb-4 pb-3 border-b border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium">{transactionDate.toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Time:</span>
                <span className="font-medium">{transactionDate.toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Transaction:</span>
                <span className="font-medium">#{transaction.id || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Served by:</span>
                <span className="font-medium">{attendantName}</span>
              </div>
            </div>
            
            <div className="space-y-3 mb-4 pb-3 border-b border-gray-200">
              {items.map((item, index) => (
                <div key={`${item.id}-${index}`} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <div className="flex-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-gray-500 ml-2">x{item.quantity}</span>
                      <span className="text-gray-500 ml-2">@ Ksh {Number(item.price).toFixed(2)}</span>
                    </div>
                    <span className="font-semibold">Ksh {Number(item.total).toFixed(2)}</span>
                  </div>
                  {(item.discount && Number(item.discount) > 0) ? (
                    <div className="flex justify-between ml-4 text-xs">
                      <span className="text-green-600">Discount</span>
                      <span className="text-green-600">-Ksh {(Number(item.discount) * Number(item.quantity)).toFixed(2)}</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold">{primaryShop?.currency || 'KES'} {Number(transaction.subtotal).toFixed(2)}</span>
              </div>
              {/* Show total discount if any items have discounts */}
              {items.some(item => item.discount && item.discount > 0) && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Total Discount:</span>
                  <span className="font-semibold text-green-600">-{primaryShop?.currency || 'KES'} {items.reduce((sum, item) => sum + ((item.discount || 0) * item.quantity), 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax ({shopTaxRate}%):</span>
                <span className="font-semibold">{primaryShop?.currency || 'KES'} {Number(transaction.tax).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                <span>Total:</span>
                <span className="text-primary">{primaryShop?.currency || 'KES'} {Number(transaction.total).toFixed(2)}</span>
              </div>
              
              {/* Split payment breakdown */}
              {transaction.paymentMethod === 'split' && (
                <div className="mt-3 pt-2 border-t border-gray-200 space-y-1">
                  <div className="text-sm font-medium text-gray-700 mb-2">Payment Breakdown:</div>
                  {transaction.amountPaid > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Cash:</span>
                      <span className="font-semibold">{primaryShop?.currency || 'KES'} {Number(transaction.amountPaid).toFixed(2)}</span>
                    </div>
                  )}
                  {(transaction as any).mpesaNewTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">M-Pesa:</span>
                      <span className="font-semibold">{primaryShop?.currency || 'KES'} {Number((transaction as any).mpesaNewTotal).toFixed(2)}</span>
                    </div>
                  )}
                  {(transaction as any).bankTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Bank:</span>
                      <span className="font-semibold">{primaryShop?.currency || 'KES'} {Number((transaction as any).bankTotal).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Regular payment method for non-split payments */}
              {transaction.paymentMethod !== 'split' && (
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-semibold capitalize">{transaction.paymentMethod}</span>
                </div>
              )}
            </div>
            
            <div className="text-center mt-4 pt-3 border-t border-gray-200 text-gray-600">
              <p className="font-medium text-sm">Thank you for your business!</p>
              <p className="text-xs">Visit us again soon</p>
              {primaryShop?.receiptemail && (
                <p className="text-xs mt-1">Questions? Email: {primaryShop.receiptemail}</p>
              )}
            </div>
          </div>
          
          {/* Receipt Actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-xl border-gray-200 hover:bg-gray-50 text-sm"
              onClick={printThermal}
            >
              <Printer className="mr-1 h-3 w-3" />
              Print
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-xl border-gray-200 hover:bg-gray-50 text-sm"
              onClick={generatePDF}
            >
              <Download className="mr-1 h-3 w-3" />
              PDF
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-xl border-gray-200 hover:bg-gray-50 text-sm"
            >
              <Mail className="mr-1 h-3 w-3" />
              Email
            </Button>
          </div>
          
          <Button
            onClick={onNewTransaction}
            className="w-full h-10 rounded-xl bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 font-semibold text-sm shadow-lg"
          >
            <Plus className="mr-1 h-4 w-4" />
            Start New Transaction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
