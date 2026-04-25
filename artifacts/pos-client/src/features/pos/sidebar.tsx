import { ScanBarcode, Store, LogOut, User, Home, TrendingUp, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useNavigationRoute } from "@/lib/navigation-utils";

export default function Sidebar() {
  // const { admin, logout } = useAuth(); // Removed for attendant POS
  const { toast } = useToast();
  const [location] = useLocation();

  const handleLogout = () => {
    // logout(); // Removed admin logout for attendant POS
    toast({
      title: "Logged Out", 
      description: "You have been successfully logged out.",
    });
  };

  const dashboardRoute = useNavigationRoute('dashboard');
  const posRoute = useNavigationRoute('pos');
  const salesRoute = useNavigationRoute('sales');
  const productsRoute = useNavigationRoute('products');
  
  const handleDashboardClick = () => {
    // Mark that user intentionally navigated to dashboard
    sessionStorage.setItem('attendantNavigatedToDashboard', 'true');
  };

  const navItems = [
    { href: dashboardRoute, icon: Home, label: "Dashboard", onClick: handleDashboardClick },
    { href: posRoute, icon: ScanBarcode, label: "POS" },
    { href: salesRoute, icon: BarChart3, label: "Sales" },
    { href: productsRoute, icon: TrendingUp, label: "Stock" },
    { href: "/shops", icon: Store, label: "Shops" },
  ];

  return (
    <div className="w-16 bg-primary flex flex-col items-center py-6 justify-between">
      <div className="flex flex-col items-center">
        {/* Logo */}
        <Link href="/dashboard">
          <div className="mb-8 cursor-pointer">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
              <span className="text-primary font-bold text-lg">P</span>
            </div>
          </div>
        </Link>
        
        {/* Navigation Icons */}
        <nav className="flex flex-col space-y-6">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <div key={item.href} className="relative group">
                <Link href={item.href} onClick={item.onClick}>
                  <Button 
                    variant="ghost"
                    size="sm"
                    className={`w-10 h-10 p-0 rounded-lg transition-colors ${
                      isActive 
                        ? "text-white bg-white/20" 
                        : "text-white/70 hover:bg-white/20 hover:text-white"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                  </Button>
                </Link>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </div>
              </div>
            );
          })}
        </nav>
      </div>


    </div>
  );
}
