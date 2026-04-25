import { Receipt } from "lucide-react";

interface ReceiptHeaderProps {
  shopData: {
    name?: string;
    address?: string;
    address_receipt?: string;
    contact?: string;
    phone?: string;
    receiptemail?: string;
    email?: string;
    paybill_account?: string;
    paybill_till?: string;
    currency?: string;
  };
  title?: string;
  className?: string;
}

export default function ReceiptHeader({ 
  shopData, 
  title = "Sales Receipt",
  className = ""
}: ReceiptHeaderProps) {
  return (
    <div className={`text-center mb-4 pb-3 border-b border-gray-200 ${className}`}>
      {title && (
        <div className="flex items-center justify-center gap-2 mb-3">
          <Receipt className="h-6 w-6" />
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
      )}
      
      <h4 className="font-bold text-lg text-gray-800 mb-1">
        {shopData?.name || 'Store Name'}
      </h4>
      
      {shopData?.address && (
        <p className="text-sm text-gray-600">{shopData.address}</p>
      )}
      
      {shopData?.address_receipt && (
        <p className="text-sm text-gray-600">{shopData.address_receipt}</p>
      )}
      
      {(shopData?.contact || shopData?.phone) && (
        <p className="text-sm text-gray-600">
          Phone: {shopData.contact || shopData.phone}
        </p>
      )}
      
      {(shopData?.receiptemail || shopData?.email) && (
        <p className="text-sm text-gray-600">
          Email: {shopData.receiptemail || shopData.email}
        </p>
      )}
      
      {(shopData?.paybill_account || shopData?.paybill_till) && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          {shopData?.paybill_account ? (
            // Show paybill with account number
            <>
              <p className="text-xs text-gray-500">
                Paybill: {shopData.paybill_account}
              </p>
              {shopData?.paybill_till && (
                <p className="text-xs text-gray-500">
                  Account: {shopData.paybill_till}
                </p>
              )}
            </>
          ) : (
            // Show only till as Buy Goods
            shopData?.paybill_till && (
              <p className="text-xs text-gray-500">
                Buy Goods: {shopData.paybill_till}
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}