import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Menu, X, Home, ScanBarcode, Package, BarChart3, History, Settings, User, LogOut, Store, ChevronDown, ChevronRight, TrendingUp, Receipt, ShoppingCart, Users, Truck, DollarSign, UserCheck, FileText, Shield, Edit, Clock } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/features/auth/useAuth";
import { useToast } from "@/hooks/use-toast";
import { navItems, menuGroups, getMenuGroups } from "@/lib/navigation";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { formatDate, formatTime } from "@/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const { admin, logout } = useAuth();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const { isExpired: isSubscriptionExpired } = useSubscriptionStatus();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Check if current route is an attendant route
  const isAttendantRoute = location.startsWith('/attendant/');

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Using dynamic navigation based on user type
  const dashboardRoute = useNavigationRoute('dashboard');
  const posRoute = useNavigationRoute('pos');
  
  const mainNavItems = [
    { href: dashboardRoute, icon: Home, label: "Dashboard" },
    { href: posRoute, icon: ScanBarcode, label: "Point of Sale" },
  ];

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar - Hidden for attendant routes */}
      {!isAttendantRoute && (
        <div className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 lg:bg-gradient-to-b lg:from-purple-900 lg:via-purple-800 lg:to-purple-900 lg:shadow-2xl lg:border-r lg:border-purple-700/50 lg:z-40">
          <div className="flex-1 h-0 overflow-y-auto overflow-x-hidden p-4 scrollbar-thin scrollbar-thumb-purple-700 scrollbar-track-purple-900/30">
            <Link href="/dashboard">
              <div className="flex items-center cursor-pointer group mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg">
                  <Store className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <h1 className="text-xl font-bold text-white tracking-tight">Pointify</h1>
                  <p className="text-xs text-purple-300 font-medium">Business Suite</p>
                </div>
              </div>
            </Link>
            
            <nav className="space-y-1">
              {isSubscriptionExpired ? (
                // Show subscription expired message and link to subscription page
                <div className="space-y-4">
                  <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4">
                    <div className="flex items-center mb-2">
                      <div className="p-2 rounded-lg mr-3 bg-red-500/20 text-red-300">
                        <Settings className="w-5 h-5" />
                      </div>
                      <span className="text-red-300 font-medium text-sm">Subscription Expired</span>
                    </div>
                    <p className="text-red-200/80 text-xs leading-relaxed mb-3">
                      Your subscription has expired. Please renew to continue using Pointify features.
                    </p>
                  </div>
                  
                  <Link href="/subscription">
                    <div className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                      location === '/subscription'
                        ? "bg-gradient-to-r from-purple-500/20 to-purple-400/20 border border-purple-400/30 shadow-lg" 
                        : "hover:bg-purple-700/50 hover:translate-x-1"
                    }`}>
                      <div className={`p-2 rounded-lg mr-4 transition-colors ${
                        location === '/subscription' ? "bg-purple-500/20 text-purple-300" : "text-purple-400 group-hover:bg-purple-600/50 group-hover:text-purple-200"
                      }`}>
                        <Settings className="w-5 h-5" />
                      </div>
                      <span className={`text-sm font-medium transition-colors ${
                        location === '/subscription' ? "text-white" : "text-purple-100 group-hover:text-white"
                      }`}>
                        Manage Subscription
                      </span>
                    </div>
                  </Link>
                </div>
              ) : (
                // Show normal navigation when subscription is active
                <>
                  {mainNavItems.map((item) => {
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
                            <item.icon className="w-5 h-5" />
                          </div>
                          <span className={`text-sm font-medium transition-colors ${
                            isActive ? "text-white" : "text-purple-100 group-hover:text-white"
                          }`}>
                            {item.label}
                          </span>
                        </div>
                      </Link>
                    );
                  })}

                  {getMenuGroups(isAttendantRoute).map((group) => {
                const isGroupActive = group.key === 'accounts' ? true : group.items.some(item => location === item.href);
                return (
                <div key={group.key} className="pt-2">
                  <button
                    onClick={() => toggleMenu(group.key)}
                    className={`w-full group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 hover:bg-purple-700/50 hover:translate-x-1 ${
                      isGroupActive ? "bg-purple-500/20" : ""
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg mr-4 transition-colors ${
                        isGroupActive ? "bg-purple-500/20 text-purple-300" : "text-purple-400 group-hover:bg-purple-600/50 group-hover:text-purple-200"
                      }`}>
                        <group.icon className="w-5 h-5" />
                      </div>
                      <span className={`text-sm font-medium transition-colors ${
                        isGroupActive ? "text-white" : "text-purple-100 group-hover:text-white"
                      }`}>
                        {group.label}
                      </span>
                    </div>
                    <div className="text-purple-400 group-hover:text-purple-200 transition-colors">
                      {expandedMenus[group.key] ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                  
                  {expandedMenus[group.key] && (
                    <div className="ml-6 mt-1 space-y-1">
                      {group.items.map((item) => {
                        const isActive = location === item.href;
                        return (
                          <Link key={item.href} href={item.href}>
                            <div className={`flex items-center px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                              isActive 
                                ? "bg-purple-500/20 text-purple-300 border border-purple-400/30" 
                                : "text-purple-200 hover:bg-purple-700/30 hover:text-white"
                            }`}>
                              <span className="text-sm">{item.label}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })}
                </>
              )}
            </nav>


        </div>
        </div>
      )}

      {/* Mobile Menu Overlay - Hidden for attendant routes */}
      {!isAttendantRoute && isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Mobile Menu - Hidden for attendant routes */}
      {!isAttendantRoute && (
        <div className={`lg:hidden fixed top-0 left-0 h-screen w-80 max-w-[90vw] sm:max-w-[85vw] bg-gradient-to-b from-purple-900 via-purple-800 to-purple-900 z-50 transform transition-transform duration-300 shadow-2xl border-r border-purple-700/50 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="flex flex-col h-full min-h-0">
          {/* Header - Fixed */}
          <div className="flex-shrink-0 p-4 border-b border-purple-700/50">
            <div className="flex items-center justify-between">
              <Link href="/dashboard">
                <div className="flex items-center cursor-pointer group">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg">
                    <Store className="h-5 w-5 text-white" />
                  </div>
                  <div className="ml-3">
                    <h1 className="text-lg font-bold text-white tracking-tight">Pointify</h1>
                    <p className="text-xs text-purple-300 font-medium">Business Suite</p>
                  </div>
                </div>
              </Link>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-white hover:bg-white/10 p-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Scrollable Navigation */}
          <div className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden p-4 scrollbar-thin smooth-scroll mobile-scroll">
            <nav className="space-y-1">
              {isSubscriptionExpired ? (
                // Show subscription expired message and link to subscription page
                <div className="space-y-3">
                  <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-3">
                    <div className="flex items-center mb-2">
                      <div className="p-1.5 rounded-md mr-2 bg-red-500/20 text-red-300">
                        <Settings className="w-4 h-4" />
                      </div>
                      <span className="text-red-300 font-medium text-sm">Subscription Expired</span>
                    </div>
                    <p className="text-red-200/80 text-xs leading-relaxed">
                      Your subscription has expired. Please renew to continue using Pointify features.
                    </p>
                  </div>
                  
                  <Link href="/subscription">
                    <div className={`group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
                      location === '/subscription'
                        ? "bg-gradient-to-r from-purple-500/20 to-purple-400/20 border border-purple-400/30 shadow-lg" 
                        : "hover:bg-purple-700/50 hover:translate-x-1"
                    }`} onClick={() => setIsMobileMenuOpen(false)}>
                      <div className={`p-1.5 rounded-md mr-3 transition-colors ${
                        location === '/subscription' ? "bg-purple-500/20 text-purple-300" : "text-purple-400 group-hover:bg-purple-600/50 group-hover:text-purple-200"
                      }`}>
                        <Settings className="w-4 h-4" />
                      </div>
                      <span className={`text-sm font-medium transition-colors ${
                        location === '/subscription' ? "text-white" : "text-purple-100 group-hover:text-white"
                      }`}>
                        Manage Subscription
                      </span>
                    </div>
                  </Link>
                </div>
              ) : (
                // Show normal navigation when subscription is active
                <>
                  {mainNavItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <div className={`group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
                      isActive 
                        ? "bg-gradient-to-r from-purple-500/20 to-purple-400/20 border border-purple-400/30 shadow-lg" 
                        : "hover:bg-purple-700/50 hover:translate-x-1"
                    }`} onClick={() => setIsMobileMenuOpen(false)}>
                      <div className={`p-1.5 rounded-md mr-3 transition-colors ${
                        isActive ? "bg-purple-500/20 text-purple-300" : "text-purple-400 group-hover:bg-purple-600/50 group-hover:text-purple-200"
                      }`}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className={`text-sm font-medium ${
                        isActive ? "text-white" : "text-purple-300 group-hover:text-white"
                      }`}>
                        {item.label}
                      </span>
                    </div>
                  </Link>
                );
              })}

                  <div className="pt-3 space-y-1">
                    {getMenuGroups(isAttendantRoute).map((group) => {
                      const isExpanded = expandedMenus[group.key];
                      return (
                        <div key={group.key}>
                          <div
                            className={`group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer hover:bg-purple-700/50 hover:translate-x-1`}
                            onClick={() => toggleMenu(group.key)}
                          >
                            <div className="p-1.5 rounded-md mr-3 transition-colors text-purple-400 group-hover:bg-purple-600/50 group-hover:text-purple-200">
                              <group.icon className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-medium text-purple-300 group-hover:text-white flex-1">
                              {group.label}
                            </span>
                            <div className="p-1 rounded-md transition-colors group-hover:bg-purple-600/50">
                              {isExpanded ? (
                                <ChevronDown className="w-3 h-3 text-purple-300" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-purple-300" />
                              )}
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="ml-3 pl-4 border-l-2 border-purple-600/50 space-y-1 mt-1">
                              {group.items.map((item) => {
                                const isActive = location === item.href;
                                return (
                                  <Link key={item.href} href={item.href}>
                                    <div className={`flex items-center px-3 py-2 rounded-md transition-all duration-200 cursor-pointer ${
                                      isActive 
                                        ? 'bg-purple-500/20 text-purple-200 shadow-md border border-purple-400/30' 
                                        : 'text-purple-400 hover:bg-purple-700/50 hover:text-purple-200 hover:translate-x-1'
                                    }`} onClick={() => setIsMobileMenuOpen(false)}>
                                      <div className="w-1.5 h-1.5 rounded-full bg-current mr-2 opacity-60"></div>
                                      <span className="text-xs font-medium">{item.label}</span>
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
                </>
              )}
              
              {/* Bottom Spacing for Scrolling */}
              <div className="pb-8"></div>
            </nav>
          </div>


        </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className={`fixed top-0 w-full z-20 bg-white shadow-sm border-b ${!isAttendantRoute ? 'lg:pl-72' : ''}`}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            {/* Mobile Menu Button - Hidden for attendant routes */}
            {!isAttendantRoute && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 mr-2"
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Store className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Welcome {admin?.username}
                </h1>
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>{formatDate(currentTime)}</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span className="font-medium">{formatTime(currentTime)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Profile & Logout - Top Right */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{admin?.username || admin?.email?.split('@')[0] || 'Admin User'}</p>
                <p className="text-xs text-gray-500">{admin?.email || 'admin@pointify.com'}</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <User className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setLocation('/edit-profile')}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex flex-col min-h-screen ${!isAttendantRoute ? 'lg:pl-72' : ''}`}>
        {/* Spacer that exactly matches the fixed header height */}
        <div className="h-16 flex-shrink-0" />


        <div className="flex-1 px-6 py-6 w-full max-w-none overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}