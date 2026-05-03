import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Menu, X, Home, ScanBarcode, Package, BarChart2, Settings, User, LogOut,
  Store, TrendingUp, Receipt, ShoppingBag, Users, Truck, DollarSign,
  UserCheck, FileText, Crown, Clock, MailWarning, Edit, RotateCcw,
  ArrowRightLeft, AlertTriangle, Banknote, ClipboardList, Building2, CreditCard,
  Printer, MessageSquare, ShoppingCart, Box, Layers
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/features/auth/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { formatDate, formatTime } from "@/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

interface NavItem { href: string; icon: any; label: string }
interface NavSection { label: string; items: NavItem[] }

interface SidebarContentProps {
  location: string;
  navSections: NavSection[];
  isSubscriptionExpired: boolean;
  onNav?: () => void;
}

function SidebarContent({ location, navSections, isSubscriptionExpired, onNav }: SidebarContentProps) {
  const [, navigate] = useLocation();

  function go(href: string) {
    navigate(href);
    onNav?.();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex-shrink-0 px-4 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => go("/dashboard")}>
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-white leading-none">Pointify</p>
            <p className="text-xs text-purple-300 mt-0.5">Business Suite</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
        {isSubscriptionExpired ? (
          <div className="space-y-2">
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-xs text-red-200">
              Subscription expired — renew to use Pointify features.
            </div>
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-purple-100 hover:bg-white/10 cursor-pointer"
              onClick={() => go("/subscription")}
            >
              <Crown className="h-4 w-4 text-purple-300 shrink-0" />
              Manage Subscription
            </div>
          </div>
        ) : (
          navSections.map(section => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest px-3 mb-1">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const isActive = location === item.href ||
                    (item.href !== '/reports' && location.startsWith(item.href) && item.href.length > 2);
                  return (
                    <div
                      key={item.href}
                      onClick={() => go(item.href)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                        isActive
                          ? "bg-white text-purple-800 font-semibold shadow-sm"
                          : "text-purple-100 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-purple-700" : "text-purple-300"}`} />
                      {item.label}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div className="pb-4" />
      </div>
    </div>
  );
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const { admin, logout } = useAuth();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const { isExpired: isSubscriptionExpired } = useSubscriptionStatus();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false);

  const isAttendantRoute = location.startsWith('/attendant/');
  const isDashboard = location === '/dashboard' || location === '/attendant/dashboard';
  const showEmailBanner = isDashboard && !emailBannerDismissed && admin && !admin.emailVerified;

  const dashboardRoute = useNavigationRoute('dashboard');
  const posRoute = useNavigationRoute('pos');
  const salesRoute = useNavigationRoute('sales');
  const purchasesRoute = useNavigationRoute('purchases');
  const customersRoute = useNavigationRoute('customers');
  const suppliersRoute = useNavigationRoute('suppliers');
  const productsRoute = useNavigationRoute('products');
  const expensesRoute = useNavigationRoute('expenses');
  const cashflowRoute = useNavigationRoute('cashflow');
  const stockSummaryRoute = useNavigationRoute('stockSummary');
  const stockCountRoute = useNavigationRoute('stockCount');
  const badStockRoute = useNavigationRoute('badStock');
  const stockTransferRoute = useNavigationRoute('stockTransfer');
  const purchaseReturnsRoute = useNavigationRoute('purchaseReturns');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const navSections: NavSection[] = [
    {
      label: "Main",
      items: [
        { href: dashboardRoute, icon: Home, label: "Dashboard" },
        { href: posRoute, icon: ScanBarcode, label: "Point of Sale" },
      ],
    },
    {
      label: "Selling",
      items: [
        { href: salesRoute, icon: Receipt, label: "Sales" },
        { href: "/returns", icon: RotateCcw, label: "Returns" },
        { href: "/orders", icon: ClipboardList, label: "Orders" },
      ],
    },
    {
      label: "Stock",
      items: [
        { href: productsRoute, icon: Box, label: "Products" },
        { href: stockSummaryRoute, icon: Layers, label: "Stock Summary" },
        { href: stockCountRoute, icon: ClipboardList, label: "Stock Count" },
        { href: badStockRoute, icon: AlertTriangle, label: "Bad Stock" },
        { href: stockTransferRoute, icon: ArrowRightLeft, label: "Transfer" },
      ],
    },
    {
      label: "Purchases",
      items: [
        { href: purchasesRoute, icon: ShoppingBag, label: "Purchases" },
        { href: purchaseReturnsRoute, icon: RotateCcw, label: "Returns" },
      ],
    },
    {
      label: "People",
      items: [
        { href: customersRoute, icon: Users, label: "Customers" },
        { href: suppliersRoute, icon: Truck, label: "Suppliers" },
        { href: "/debtors", icon: CreditCard, label: "Debtors" },
      ],
    },
    {
      label: "Reports",
      items: [
        { href: "/reports", icon: BarChart2, label: "All Reports" },
        { href: "/reports/sales", icon: DollarSign, label: "Sales Report" },
        { href: "/reports/products", icon: TrendingUp, label: "Products Report" },
        { href: "/profit-loss", icon: FileText, label: "Profit & Loss" },
        { href: expensesRoute, icon: Banknote, label: "Expenses" },
        { href: cashflowRoute, icon: ArrowRightLeft, label: "Cash Flow" },
      ],
    },
    {
      label: "Settings",
      items: [
        { href: "/shops", icon: Store, label: "Shops" },
        { href: "/attendants", icon: UserCheck, label: "Attendants" },
        { href: "/subscription", icon: Crown, label: "Subscription" },
        { href: "/printer-config", icon: Printer, label: "Printer Setup" },
        { href: "/sms-settings", icon: MessageSquare, label: "SMS Settings" },
        { href: "/settings", icon: Settings, label: "Settings" },
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      {!isAttendantRoute && (
        <div className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 lg:bg-gradient-to-b lg:from-purple-900 lg:via-purple-800 lg:to-purple-900 lg:z-40">
          <SidebarContent
            location={location}
            navSections={navSections}
            isSubscriptionExpired={isSubscriptionExpired}
          />
        </div>
      )}

      {/* Mobile Overlay */}
      {!isAttendantRoute && isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Mobile Sidebar */}
      {!isAttendantRoute && (
        <div className={`lg:hidden fixed top-0 left-0 h-screen w-64 bg-gradient-to-b from-purple-900 via-purple-800 to-purple-900 z-50 transition-transform duration-300 shadow-2xl ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="absolute top-3 right-3">
            <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(false)} className="text-white hover:bg-white/10 p-2 h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <SidebarContent
            location={location}
            navSections={navSections}
            isSubscriptionExpired={isSubscriptionExpired}
            onNav={() => setIsMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Top Header */}
      <div className={`fixed top-0 w-full z-20 bg-white shadow-sm border-b ${!isAttendantRoute ? "lg:pl-60" : ""}`}>
        <div className="flex items-center justify-between px-3 lg:px-4 py-2.5 lg:py-3">
          <div className="flex items-center gap-2">
            {isAttendantRoute && (
              <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2">
                <Menu className="w-5 h-5" />
              </Button>
            )}
            {isDashboard ? (
              <div>
                <h1 className="text-sm font-bold text-gray-900 leading-none">Welcome, {admin?.username}</h1>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                  <span>{formatDate(currentTime)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(currentTime)}</span>
                </div>
              </div>
            ) : title ? (
              <h1 className="text-sm font-semibold text-gray-900 lg:hidden">{title}</h1>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 leading-none">{admin?.username || "Admin"}</p>
                <p className="text-xs text-gray-400 mt-0.5">{admin?.email}</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900">
                  <User className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setLocation('/edit-profile')}>
                  <Edit className="w-4 h-4 mr-2" /> Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation('/settings')}>
                  <Settings className="w-4 h-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex flex-col min-h-screen ${!isAttendantRoute ? "lg:pl-60" : ""}`}>
        <div className="h-[57px] flex-shrink-0" />

        {showEmailBanner && (
          <div className="px-4 pt-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-800">
              <div className="flex items-center gap-2 text-sm">
                <MailWarning className="h-4 w-4 shrink-0" />
                <span><strong>Verify your email</strong> — check your inbox to secure your account.</span>
              </div>
              <button onClick={() => setEmailBannerDismissed(true)} className="rounded p-1 hover:bg-amber-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 px-4 py-4 lg:px-6 lg:py-6 w-full max-w-none overflow-x-hidden pb-20 lg:pb-0">
          {children}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      {!isAttendantRoute && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-xl">
          <div className="flex items-stretch justify-around">
            {([
              { href: dashboardRoute, icon: Home,      label: "Home"       },
              { href: "/shops",       icon: Store,     label: "Shops"      },
              { href: "/attendants",  icon: UserCheck, label: "Attendants" },
            ] as { href: string; icon: any; label: string }[]).map((tab) => {
              const isActive = location === tab.href ||
                (tab.href.length > 2 && location.startsWith(tab.href));
              return (
                <button
                  key={tab.href}
                  onClick={() => setLocation(tab.href)}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 min-h-[56px] transition-colors ${
                    isActive
                      ? "text-purple-700 bg-purple-50"
                      : "text-gray-500 hover:text-gray-700 active:bg-gray-100"
                  }`}
                >
                  <tab.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-purple-700" : ""}`} />
                  <span className="text-[10px] font-medium leading-none mt-0.5">{tab.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => setIsMobileMoreOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 min-h-[56px] transition-colors ${isMobileMoreOpen ? "text-purple-700 bg-purple-50" : "text-gray-500 hover:text-gray-700 active:bg-gray-100"}`}
            >
              <Menu className={`h-5 w-5 shrink-0 ${isMobileMoreOpen ? "text-purple-700" : ""}`} />
              <span className="text-[10px] font-medium leading-none mt-0.5">More</span>
            </button>
          </div>
        </nav>
      )}

      {/* Mobile "More" bottom sheet — separate from desktop sidebar */}
      <Sheet open={isMobileMoreOpen} onOpenChange={setIsMobileMoreOpen}>
        <SheetContent side="bottom" className="lg:hidden rounded-t-2xl max-h-[80vh] flex flex-col p-0">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
            <SheetTitle className="text-sm font-semibold text-gray-700 text-left">All Pages</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
            {navSections.map(section => (
              <div key={section.label}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{section.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {section.items.map(item => {
                    const isActive = location === item.href ||
                      (item.href.length > 2 && location.startsWith(item.href));
                    return (
                      <button
                        key={item.href}
                        onClick={() => { setLocation(item.href); setIsMobileMoreOpen(false); }}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 transition-colors ${isActive ? "bg-purple-50 text-purple-700" : "bg-gray-50 text-gray-600 active:bg-gray-100"}`}
                      >
                        <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-purple-700" : "text-gray-500"}`} />
                        <span className="text-[10px] font-medium leading-tight text-center">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Logout */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Account</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => { setLocation('/settings'); setIsMobileMoreOpen(false); }}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 bg-gray-50 text-gray-600 active:bg-gray-100"
                >
                  <Settings className="h-5 w-5 shrink-0 text-gray-500" />
                  <span className="text-[10px] font-medium leading-tight text-center">Settings</span>
                </button>
                <button
                  onClick={() => { handleLogout(); setIsMobileMoreOpen(false); }}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 bg-red-50 text-red-600 active:bg-red-100"
                >
                  <LogOut className="h-5 w-5 shrink-0 text-red-500" />
                  <span className="text-[10px] font-medium leading-tight text-center">Sign Out</span>
                </button>
              </div>
            </div>
            <div className="h-4" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
