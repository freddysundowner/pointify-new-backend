import { Switch, Route, useLocation } from "wouter";

import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ProductsProvider } from "@/contexts/ProductsContext";
import { AttendantAuthProvider } from "@/contexts/AttendantAuthContext";
import { AttendantSessionChecker } from "@/components/AttendantSessionChecker";
import { useAuth } from "@/features/auth/useAuth";
import { useEffect } from "react";
import POS from "@/features/pos/pos";
import BusinessDashboard from "@/features/dashboard/business-dashboard";
import Login from "@/features/auth/login";
import BusinessLogin from "@/features/auth/business-login";
import Signup from "@/features/auth/signup";
import ForgotPassword from "@/features/auth/forgot-password";
import ResetPassword from "@/features/auth/reset-password";
import ShopSetup from "@/features/shop/shop-setup";
import ShopOnboarding from "@/features/shop/shop-onboarding";
import Shops from "@/features/shop/shops";
import ShopDetails from "@/features/shop/shop-details";
import StockProducts from "@/features/inventory/stock-products";
import StockCount from "@/features/shop/stock-count";
import StockCountHistoryPage from "@/pages/stock-count-history";
import StockSummary from "@/pages/stock-summary";
import StockBadStock from "@/features/inventory/stock-bad-stock";
import StockTransfer from "@/features/shop/stock-transfer";
import ProductForm from "@/features/inventory/product-form";
import ProductHistory from "@/features/inventory/product-history";
import AdjustmentHistoryPage from "@/pages/adjustment-history";

import SalesList from "@/features/sales/sales-list";
import ReturnsList from "@/features/sales/returns-list";
import ReceiptView from "@/features/sales/receipt-view";
import EditSale from "@/features/sales/edit-sale";
import ReturnSale from "@/features/sales/return-sale";
import DeleteSale from "@/features/sales/delete-sale";
import PurchasesList from "@/features/purchases/purchases-list";
import PurchaseOrderPage from "@/pages/purchase-order";
import ReturnPurchase from "@/pages/return-purchase";
import PurchaseReturns from "@/pages/purchase-returns";
import PurchaseReturnDetails from "@/pages/purchase-return-details";

import ReceivePurchase from "@/features/purchases/receive-purchase";
import CancelPurchase from "@/features/purchases/cancel-purchase";
import CreatePurchase from "@/features/purchases/create-purchase";
import Suppliers from "@/features/suppliers/suppliers";
import SupplierOverview from "@/features/suppliers/supplier-overview";
import Customers from "@/features/customers/customers";
import CustomerOverview from "@/features/customers/customer-overview";
import Expenses from "@/features/expenses/expenses";
import StaffPermissions from "@/features/attendants/staff-permissions";
import PermissionsInit from "@/components/PermissionsInit";
import CashFlow from "@/features/cashflow/cashflow";
import IncomeReports from "@/features/reports/income-reports";
import ProfitAnalysis from "@/features/reports/profit-analysis";
import DiscountReports from "@/features/reports/discount-reports";
import StockReport from "@/features/reports/stock-report";
import ProductMovements from "@/features/reports/product-movements";
import SubscriptionPage from "@/pages/subscription";
import PaymentWaiting from "@/pages/payment-waiting"; 
import EditProfilePage from "@/pages/edit-profile";
import ExpenseCategories from "@/pages/expense-categories";
import CashflowCategories from "@/pages/cashflow-categories";
import ProfitLossPage from "@/pages/profit-loss";
import DebtorsPage from "@/pages/debtors";
import PrinterConfigPage from "@/pages/printer-config";
import SettingsPage from "@/pages/settings";
import SmsSettingsPage from "@/pages/sms-settings";

import AttendantsPage from "@/features/attendants/attendants";

import OrdersPage from "@/pages/orders";
import PurchasePaymentPage from "@/pages/purchase-payment";
import PurchaseViewPage from "@/pages/purchase-view";
import PurchaseEditPage from "@/pages/purchase-edit";
import SupplierHistoryPage from "@/pages/supplier-history";
import BulkCreateProducts from "@/pages/bulk-create-products";
import NotFound from "@/pages/not-found";
import AttendantLogin from "@/pages/attendant-login";
import AttendantDashboard from "@/pages/attendant-dashboard";
import { AttendantRoute } from "@/components/AttendantRoute";
import UserSwitchPage from "@/components/UserSwitchPage";
import AdminRouteHandler from "@/components/AdminRouteHandler";
import ServerUnavailable from "@/components/ui/server-unavailable";



function AppContent() {
  const { isAuthenticated, isLoading, admin, serverError } = useAuth();
  const [, setLocation] = useLocation();
  const [location] = useLocation();

  // Check if user has a primary shop from admin data (API returns `shop` or `primaryShop`)
  const hasPrimaryShop = admin?.primaryShop ?? (admin as any)?.shop;

  // Auto-route based on localStorage on initial load
  useEffect(() => {
    
    // Don't auto-redirect if user is already on attendant routes
    if (location.startsWith('/attendant/')) {
      return;
    }
    
    // Only check on initial load (root path)
    if (location === '/' && !isLoading) {
      const attendantData = localStorage.getItem('attendantData');
      const adminData = localStorage.getItem('adminData') || localStorage.getItem('authToken');
      
      if (attendantData) {
        // Attendant is logged in - check if they have can_sell permission
        try {
          const attendant = JSON.parse(attendantData);
          const hasCanSell = attendant.permissions?.some((p: any) => 
            p.key === 'pos' && p.value?.includes('can_sell')
          );
          
          if (hasCanSell) {
            setLocation('/attendant/pos');
          } else {
            setLocation('/attendant/dashboard');
          }
          return;
        } catch {
          setLocation('/attendant/dashboard');
          return;
        }
      }
      
      if (adminData && isAuthenticated) {
        // Admin is logged in - go to admin dashboard
        setLocation('/dashboard');
        return;
      }
      
      // No one is logged in - go to login selection
      if (!isAuthenticated && !attendantData) {
        setLocation('/login');
        return;
      }
    }
  }, [location, isLoading, isAuthenticated, setLocation]);

  // Redirect authenticated users without primary shop to onboarding
  // Only redirect if we have fresh data from the server (no server errors)
  useEffect(() => {
    if (isAuthenticated && !isLoading && admin && !hasPrimaryShop && !serverError) {
      setLocation('/onboarding');
    }
  }, [isAuthenticated, isLoading, admin, hasPrimaryShop, setLocation, serverError]);

  // Removed server error page - let app load normally even if API is down

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600">Loading Pointify...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Attendant routes - always check first before admin auth */}
      <Route path="/attendant/login" component={AttendantLogin} />
      <Route path="/attendant/pos" component={POS} />
      <Route path="/attendant/dashboard">
        {() => (
          <AttendantRoute>
            <AttendantDashboard />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/products">
        {() => (
          <AttendantRoute>
            <StockProducts />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/sales">
        {() => (
          <AttendantRoute>
            <SalesList />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/sales/return/:id">
        {() => (
          <AttendantRoute>
            <ReturnSale />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/receipt/:id">
        {() => (
          <AttendantRoute>
            <ReceiptView />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/sales/edit/:id">
        {() => (
          <AttendantRoute>
            <EditSale />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/customers">
        {() => (
          <AttendantRoute>
            <Customers />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/customer-overview">
        {() => (
          <AttendantRoute>
            <CustomerOverview />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/purchases">
        {() => (
          <AttendantRoute>
            <PurchasesList />
          </AttendantRoute>
        )}
      </Route>
      {/* /purchases/create */}
      <Route path="/attendant/purchases/create">
        {() => (
          <AttendantRoute>
            <CreatePurchase />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/purchases/view/:id">
        {() => (
          <AttendantRoute>
            <PurchaseViewPage />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/purchases/edit/:id">
        {() => (
          <AttendantRoute>
            <PurchaseEditPage />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/purchases/pay/:id">
        {() => (
          <AttendantRoute>
            <PurchasePaymentPage />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/purchases/return/:id">
        {() => (
          <AttendantRoute>
            <ReturnPurchase />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/purchases/returns">
        {() => (
          <AttendantRoute>
            <PurchaseReturns />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/purchase-return-details/:id">
        {() => (
          <AttendantRoute>
            <PurchaseReturnDetails />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/suppliers">
        {() => (
          <AttendantRoute>
            <Suppliers />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/supplier-history">
        {() => (
          <AttendantRoute>
            <SupplierHistoryPage />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/stock/summary">
        {() => (
          <AttendantRoute>
            <StockSummary />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/stock/count">
        {() => (
          <AttendantRoute>
            <StockCount />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/stock/count-history">
        {() => (
          <AttendantRoute>
            <StockCountHistoryPage />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/stock/transfer">
        {() => (
          <AttendantRoute>
            <StockTransfer />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/stock/bad-stock">
        {() => (
          <AttendantRoute>
            <StockBadStock />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/stock/add-product">
        {() => (
          <AttendantRoute>
            <ProductForm />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/stock/edit-product/:id">
        {() => (
          <AttendantRoute>
            <ProductForm />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/product/:id/history">
        {() => (
          <AttendantRoute>
            <ProductHistory />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/product/adjustment-history/:id">
        {() => (
          <AttendantRoute>
            <AdjustmentHistoryPage />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/expenses">
        {() => (
          <AttendantRoute>
            <Expenses />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/expense-categories">
        {() => (
          <AttendantRoute>
            <ExpenseCategories />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/cashflow">
        {() => (
          <AttendantRoute>
            <CashFlow />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/cashflow-categories">
        {() => (
          <AttendantRoute>
            <CashflowCategories />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/profit-analysis">
        {() => (
          <AttendantRoute>
            <ProfitAnalysis />
          </AttendantRoute>
        )}
      </Route>
      <Route path="/attendant/profit-loss">
        {() => (
          <AttendantRoute>
            <ProfitLossPage />
          </AttendantRoute>
        )}
      </Route>

      {isAuthenticated ? (
        hasPrimaryShop ? (
          <>
            <Route path="/" component={BusinessDashboard} />
            <Route path="/dashboard" component={BusinessDashboard} />
            <Route path="/pos" component={POS} />
            <Route path="/sales" component={SalesList} />
            <Route path="/returns" component={ReturnsList} />
            <Route path="/orders" component={OrdersPage} />
            <Route path="/receipt/:id" component={ReceiptView} />
            <Route path="/sales/edit/:id" component={EditSale} />
            <Route path="/sales/return/:id" component={ReturnSale} />
            <Route path="/sales/delete/:id" component={DeleteSale} />
            <Route path="/purchases" component={PurchasesList} />
            <Route path="/purchases/order" component={PurchaseOrderPage} />
            <Route path="/purchases/create" component={CreatePurchase} />
            <Route path="/purchases/view/:id" component={PurchaseViewPage} />
            <Route path="/purchases/edit/:id" component={PurchaseEditPage} />
            <Route path="/purchases/pay/:id" component={PurchasePaymentPage} />
            <Route path="/purchases/return/:id" component={ReturnPurchase} />
            <Route path="/purchase-returns" component={PurchaseReturns} />
            <Route path="/purchase-return-details/:id" component={PurchaseReturnDetails} />
            <Route path="/purchases/receive/:id" component={ReceivePurchase} />
            <Route path="/purchases/cancel/:id" component={CancelPurchase} />
            <Route path="/suppliers" component={Suppliers} />
            <Route path="/supplier-history" component={SupplierHistoryPage} />
            <Route path="/supplier-overview" component={SupplierOverview} />
            <Route path="/customers" component={Customers} />
            <Route path="/customer-overview" component={CustomerOverview} />
            <Route path="/expenses" component={Expenses} />
            <Route path="/expense-categories" component={ExpenseCategories} />
            <Route path="/attendants" component={AttendantsPage} />
            <Route path="/staff-permissions" component={StaffPermissions} />
            <Route path="/cashflow" component={CashFlow} />
            <Route path="/cashflow-categories" component={CashflowCategories} />
            <Route path="/income-reports" component={IncomeReports} />
            <Route path="/profit-analysis" component={ProfitAnalysis} />
            <Route path="/profit-loss" component={ProfitLossPage} />
            <Route path="/debtors" component={DebtorsPage} />
            <Route path="/printer-config" component={PrinterConfigPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/sms-settings" component={SmsSettingsPage} />

            <Route path="/discount-reports" component={DiscountReports} />
            <Route path="/stock-report" component={StockReport} />
            <Route path="/product-movements" component={ProductMovements} />
            <Route path="/shops" component={Shops} />
            <Route path="/shop/:id" component={ShopDetails} />
            <Route path="/shop-setup" component={ShopSetup} />
            <Route path="/shop/setup" component={ShopSetup} />
            <Route path="/stock/products" component={StockProducts} />
            <Route path="/stock/summary" component={StockSummary} />
            <Route path="/stock/count" component={StockCount} />
            <Route path="/stock/count-history" component={StockCountHistoryPage} />
            <Route path="/bulk-create-products" component={BulkCreateProducts} />
            <Route path="/stock/bad-stock" component={StockBadStock} />
            <Route path="/stock/transfer" component={StockTransfer} />
            <Route path="/stock/add-product" component={ProductForm} />
            <Route path="/stock/edit-product/:id" component={ProductForm} />
            <Route path="/product/:id/history" component={ProductHistory} />
            <Route path="/product/adjustment-history/:id" component={AdjustmentHistoryPage} />
            <Route path="/subscription" component={SubscriptionPage} />
            <Route path="/payment-waiting" component={PaymentWaiting} />
            <Route path="/edit-profile" component={EditProfilePage} />
            <Route component={() => <BusinessDashboard />} />
          </>
        ) : (
          <>
            <Route path="/onboarding" component={ShopOnboarding} />
            <Route path="/shop-setup" component={ShopSetup} />
            <Route component={() => <ShopOnboarding />} />
          </>
        )
      ) : (
        <>
          {/* Attendant routes - always available */}
          <Route path="/attendant/login" component={AttendantLogin} />
          <Route path="/attendant/pos" component={POS} />
          <Route path="/attendant/dashboard">
            {() => (
              <AttendantRoute>
                <AttendantDashboard />
              </AttendantRoute>
            )}
          </Route>
          <Route path="/attendant/products">
            {() => (
              <AttendantRoute>
                <StockProducts />
              </AttendantRoute>
            )}
          </Route>
          <Route path="/attendant/customers">
            {() => (
              <AttendantRoute>
                <Customers />
              </AttendantRoute>
            )}
          </Route>
          <Route path="/attendant/sales">
            {() => (
              <AttendantRoute>
                <SalesList />
              </AttendantRoute>
            )}
          </Route>
          <Route path="/attendant/purchases">
            {() => (
              <AttendantRoute>
                <PurchasesList />
              </AttendantRoute>
            )}
          </Route>
          <Route path="/attendant/suppliers">
            {() => (
              <AttendantRoute>
                <Suppliers />
              </AttendantRoute>
            )}
          </Route>
          <Route path="/attendant/stock-count">
            {() => (
              <AttendantRoute>
                <StockCount />
              </AttendantRoute>
            )}
          </Route>
          <Route path="/attendant/stock-transfer">
            {() => (
              <AttendantRoute>
                <StockTransfer />
              </AttendantRoute>
            )}
          </Route>
          <Route path="/attendant/expenses">
            {() => (
              <AttendantRoute>
                <Expenses />
              </AttendantRoute>
            )}
          </Route>
          <Route path="/attendant/cashflow">
            {() => (
              <AttendantRoute>
                <CashFlow />
              </AttendantRoute>
            )}
          </Route>
          <Route path="/attendant/profit-analysis">
            {() => (
              <AttendantRoute>
                <ProfitAnalysis />
              </AttendantRoute>
            )}
          </Route>
          
          {/* Public routes */}
          <Route path="/" component={Login} />
          <Route path="/login" component={Login} />
          <Route path="/login-selection" component={Login} />
          <Route path="/business-login" component={BusinessLogin} />
          <Route path="/signup" component={Signup} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          
          {/* Handle special case: admin routes when attendant is logged in */}
          <Route path="/attendants" component={() => <AdminRouteHandler targetRoute="/attendants" />} />
          <Route path="/dashboard" component={() => <AdminRouteHandler targetRoute="/dashboard" />} />
          <Route path="/shops" component={() => <AdminRouteHandler targetRoute="/shops" />} />
          
          <Route component={Login} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AttendantAuthProvider>
          <ProductsProvider>
            <TooltipProvider>
              <PermissionsInit>
                <AttendantSessionChecker />
                <AppContent />
              </PermissionsInit>
              <Toaster />
            </TooltipProvider>
          </ProductsProvider>
        </AttendantAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
