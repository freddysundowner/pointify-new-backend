import { ScanBarcode, Package, History, BarChart, LogOut, User, Home, Settings, Store, ChevronDown, ChevronRight, TrendingUp, Hash, AlertTriangle, ArrowRightLeft, BarChart3, ShoppingCart, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
// import { useAuth } from "@/features/auth/useAuth"; // Removed for attendant POS
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useState } from "react";

export default function ExpandedSidebar() {
  // const { admin, logout } = useAuth(); // Removed for attendant POS
  const { toast } = useToast();
  const [location] = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  const handleLogout = () => {
    // logout(); // Removed admin logout for attendant POS
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
  };

  const navItems = [
    { href: "/dashboard", icon: Home, label: "Dashboard" },
    { href: "/pos", icon: ScanBarcode, label: "POS" },
    { href: "/sales", icon: BarChart3, label: "Sales" },
    { href: "/purchases", icon: ShoppingCart, label: "Purchases" },
  ];

  const menuGroups = [
    {
      key: "stock",
      label: "Stock",
      icon: TrendingUp,
      items: [
        { href: "/stock/products", label: "Products" },
        { href: "/stock/count", label: "Count" },
        { href: "/stock/bad-stock", label: "Bad Stock" },
        { href: "/stock/transfer", label: "Transfer" },
      ]
    },
    {
      key: "shops",
      label: "Shops",
      icon: Store,
      items: [
        { href: "/shops", label: "All Shops" },
        { href: "/shop-setup", label: "Add New Shop" },
      ]
    },
    {
      key: "settings",
      label: "Settings",
      icon: Settings,
      items: [
        { href: "/settings", label: "Account Settings" },
        { href: "/sms-settings", label: "SMS Settings" },
        { href: "/printer-config", label: "Printer Config" },
      ]
    },
  ];



  return (
    <div className="hidden lg:flex w-72 bg-gradient-to-b from-purple-900 via-purple-800 to-purple-900 flex-col justify-between shadow-2xl border-r border-purple-700/50">
      {/* Header */}
      <div className="p-6">
        <Link href="/dashboard">
          <div className="flex items-center mb-8 cursor-pointer group">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg">
              <Store className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <h1 className="text-xl font-bold text-white tracking-tight">Pointify</h1>
              <p className="text-xs text-purple-300 font-medium">Business Suite</p>
            </div>
          </div>
        </Link>
        
        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? "bg-gradient-to-r from-purple-500/20 to-purple-400/20 border border-purple-400/30 shadow-lg" 
                    : "hover:bg-purple-700/50 hover:translate-x-1"
                }`}>
                  <div className={`p-2 rounded-lg mr-4 transition-colors ${
                    isActive ? "bg-purple-500/20 text-purple-300" : "text-purple-400 group-hover:bg-purple-600/50 group-hover:text-purple-200"
                  }`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className={`font-medium ${
                    isActive ? "text-white" : "text-purple-300 group-hover:text-white"
                  }`}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}

          {/* Menu Groups */}
          <div className="pt-3 space-y-1">
            {menuGroups.map((group) => {
              const isExpanded = expandedMenus[group.key];
              const hasActiveItem = group.items.some(item => location === item.href);
              
              return (
                <div key={group.key} className="space-y-1">
                  <div
                    className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                      hasActiveItem 
                        ? 'bg-gradient-to-r from-purple-500/20 to-purple-400/20 border border-purple-400/30 shadow-lg' 
                        : 'hover:bg-purple-700/50 hover:translate-x-1'
                    }`}
                    onClick={() => toggleMenu(group.key)}
                  >
                    <div className={`p-2 rounded-lg mr-4 transition-colors ${
                      hasActiveItem ? "bg-purple-500/20 text-purple-300" : "text-purple-400 group-hover:bg-purple-600/50 group-hover:text-purple-200"
                    }`}>
                      <group.icon className="h-5 w-5" />
                    </div>
                    <span className={`font-medium flex-1 ${
                      hasActiveItem ? "text-white" : "text-purple-300 group-hover:text-white"
                    }`}>
                      {group.label}
                    </span>
                    <div className={`p-1 rounded-md transition-colors ${
                      hasActiveItem ? "bg-purple-500/20" : "group-hover:bg-purple-600/50"
                    }`}>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-purple-300" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-purple-300" />
                      )}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="ml-4 pl-8 border-l-2 border-purple-600/50 space-y-1">
                      {group.items.map((item) => {
                        const isActive = location === item.href;
                        return (
                          <Link key={item.href} href={item.href}>
                            <div className={`flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
                              isActive 
                                ? 'bg-purple-500/20 text-purple-200 shadow-md border border-purple-400/30' 
                                : 'text-purple-400 hover:bg-purple-700/50 hover:text-purple-200 hover:translate-x-1'
                            }`}>
                              <div className="w-2 h-2 rounded-full bg-current mr-3 opacity-60"></div>
                              <span className="text-sm font-medium">{item.label}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>
      </div>


    </div>
  );
}