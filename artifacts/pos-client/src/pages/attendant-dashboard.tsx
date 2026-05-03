import { useEffect, useState, Suspense } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Store, 
  Clock, 
  LogOut, 
  ShoppingCart, 
  Package, 
  Users, 
  BarChart3,
  DollarSign,
  Settings,
  Truck,
  Receipt,
  FileText,
  TrendingUp,
  Wallet,
  UserCheck,
  ClipboardList,
  Archive,
  RefreshCw,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAttendantAuth } from '@/contexts/AttendantAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ENDPOINTS } from '@/lib/api-endpoints';
import { apiRequest } from '@/lib/queryClient';

interface AttendantData {
  _id: string;
  username: string;
  uniqueDigits: number;
  shopId: string | { _id: string; name: string };
  adminId: string;
  permissions: Array<{ key: string; value: string[] }>;
  status: string;
}

function AttendantDashboardContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { attendant, isAuthenticated, isLoading, isRefreshing, logout, refreshAttendantData } = useAttendantAuth();
  const { hasPermission, hasAttendantPermission } = usePermissions();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('Loading...');



  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/attendant/login');
      return;
    }
    
    // Only auto-redirect to POS on initial page load (from login or refresh to dashboard)
    // but allow intentional navigation back to dashboard from POS
    if (isAuthenticated && attendant && !isLoading) {
      const hasCanSell = hasAttendantPermission('pos', 'can_sell');
      const wasRedirectedFromLogin = sessionStorage.getItem('attendantLoginRedirect') === 'true';
      const isDirectDashboardAccess = !sessionStorage.getItem('attendantNavigatedToDashboard');
      
      if (hasCanSell && (wasRedirectedFromLogin || isDirectDashboardAccess)) {
        console.log('Attendant has can_sell permission - redirecting to POS (initial access)');
        sessionStorage.removeItem('attendantLoginRedirect');
        sessionStorage.setItem('attendantNavigatedToDashboard', 'true');
        setLocation('/attendant/pos');
        return;
      }
    }
    
    // Update time every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, [isAuthenticated, isLoading, attendant, setLocation, hasAttendantPermission]);

  // Fetch shop name and cache subscription data when attendant data is available
  useEffect(() => {
    const fetchShopData = async () => {
      if (attendant?.shopId) {
        try {
          const shopId = typeof attendant.shopId === 'object' ? attendant.shopId._id : attendant.shopId;
          const response = await apiRequest('GET', ENDPOINTS.shop.getById(shopId));
          const shopData = await response.json();
          setShopName(shopData.name || 'Unknown Shop');
          
          // Store complete shop data with subscription info for permission checks
          localStorage.setItem('currentShopData', JSON.stringify(shopData));
          console.log('Cached shop subscription data for attendant permissions:', {
            shopId: shopData._id,
            subscriptionStatus: shopData.subscription?.status,
            subscriptionEndDate: shopData.subscription?.endDate
          });
        } catch (error) {
          console.error('Error fetching shop data:', error);
          setShopName('Unknown Shop');
        }
      }
    };

    fetchShopData();
  }, [attendant?.shopId]);

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out", 
      description: "You have been successfully logged out."
    });
  };

  const handleRefresh = async () => {
    try {
      await refreshAttendantData();

      toast({
        title: "Data Refreshed",
        description: "Attendant data has been updated successfully."
      });
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh attendant data. Using cached data.",
        variant: "destructive"
      });
    }
  };

  const getShopName = (shopId: string | { _id: string; name: string }) => {
    if (typeof shopId === 'object' && shopId.name) {
      return shopId.name;
    }
    
    // If we have the attendant data, the shop name might be embedded in it
    // We'll need to make an API call to get the shop details
    return 'Loading...';
  };

  const hasSpecificPermission = (permissionValue: string) => {
    return attendant?.permissions?.some(p => p.value.includes(permissionValue)) || false;
  };

  const getAllPermissionValues = () => {
    const allValues: string[] = [];
    attendant?.permissions?.forEach(p => {
      allValues.push(...p.value);
    });
    return allValues;
  };

  // Function to check if attendant has any permissions for a group key
  const hasGroupPermission = (groupKey: string) => {
    return attendant?.permissions?.some(p => p.key === groupKey) || false;
  };

  const getPermissionActions = (groupKey: string) => {
    const permission = attendant?.permissions?.find(p => p.key === groupKey);
    return permission?.value || [];
  };

  if (isLoading || !attendant) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Debug: Log attendant permissions
  console.log('=== ATTENDANT PERMISSIONS DEBUG ===');
  console.log('Attendant data:', attendant);
  console.log('Attendant permissions:', attendant.permissions);
  
  // Check subscription status from usePermissions hook  
  const permissionsHook = usePermissions();
  const isSubscriptionExpired = permissionsHook.canAccessRoute ? false : true; // Simplified check
  console.log('Subscription expired:', isSubscriptionExpired);
  
  console.log('POS can_sell permission:', hasAttendantPermission('pos', 'can_sell'));
  console.log('Sales view_sales permission:', hasAttendantPermission('sales', 'view_sales'));
  console.log('Stocks view_products permission:', hasAttendantPermission('stocks', 'view_products'));

  const actionGroups = [
    {
      id: 'sales',
      title: 'Sales & Orders',
      icon: ShoppingCart,
      description: 'Process sales and manage orders',
      enabled: hasAttendantPermission('pos', 'can_sell') || hasAttendantPermission('sales', 'view_sales'),
      color: 'bg-green-500',
      subActions: [
        {
          title: 'Point of Sale',
          icon: ShoppingCart,
          description: 'Process sales and transactions',
          enabled: hasAttendantPermission('pos', 'can_sell'),
          route: '/attendant/pos'
        },
        {
          title: 'Sales History',
          icon: Receipt,
          description: 'View sales records and receipts',
          enabled: hasAttendantPermission('sales', 'view_sales'),
          route: '/attendant/sales'
        }
      ]
    },
    {
      id: 'inventory',
      title: 'Inventory',
      icon: Package,
      description: 'Manage products and stock',
      enabled: hasAttendantPermission('stocks', 'view_products') || hasAttendantPermission('stocks', 'stock_count'),
      color: 'bg-blue-500',
      subActions: [
        {
          title: 'Products',
          icon: Package,
          description: 'Manage inventory and stock',
          enabled: hasAttendantPermission('stocks', 'view_products'),
          route: '/attendant/products'
        },
        {
          title: 'Stock Summary',
          icon: Archive,
          description: 'View stock analytics and insights',
          enabled: hasAttendantPermission('stocks', 'stock_summary'),
          route: '/attendant/stock/summary'
        },
        {
          title: 'Stock Count',
          icon: ClipboardList,
          description: 'Perform inventory counting',
          enabled: hasAttendantPermission('stocks', 'stock_count'),
          route: '/attendant/stock-count'
        },
        {
          title: 'Stock Transfer',
          icon: RefreshCw,
          description: 'Transfer stock between locations',
          enabled: hasAttendantPermission('stocks', 'transfer'),
          route: '/attendant/stock-transfer'
        },
        {
          title: 'Bad Stock',
          icon: AlertTriangle,
          description: 'Report damaged or expired inventory',
          enabled: hasAttendantPermission('stocks', 'badstock'),
          route: '/attendant/stock/bad-stock'
        }
      ]
    },
    {
      id: 'purchases',
      title: 'Purchases',
      icon: Truck,
      description: 'Manage purchase orders and returns',
      enabled: hasAttendantPermission('stocks', 'view_purchases'),
      color: 'bg-yellow-500',
      subActions: [
        {
          title: 'Purchase Orders',
          icon: Truck,
          description: 'Manage purchase orders',
          enabled: hasAttendantPermission('stocks', 'view_purchases'),
          route: '/attendant/purchases'
        },
        {
          title: 'Purchase Returns',
          icon: RefreshCw,
          description: 'Manage purchase returns',
          enabled: hasAttendantPermission('stocks', 'return'),
          route: '/attendant/purchases/returns'
        }
      ]
    },
    {
      id: 'users',
      title: 'Users',
      icon: Users,
      description: 'Manage customers and suppliers',
      enabled: hasAttendantPermission('customers', 'manage') || hasAttendantPermission('suppliers', 'view') || hasAttendantPermission('suppliers', 'manage'),
      color: 'bg-purple-500',
      subActions: [
        {
          title: 'Customers',
          icon: Users,
          description: 'Manage customer accounts',
          enabled: hasAttendantPermission('customers', 'manage'),
          route: '/attendant/customers'
        },
        {
          title: 'Suppliers',
          icon: UserCheck,
          description: 'Manage supplier relationships',
          enabled: hasAttendantPermission('suppliers', 'view') || hasAttendantPermission('suppliers', 'manage'),
          route: '/attendant/suppliers'
        }
      ]
    },
    {
      id: 'accounts',
      title: 'Accounts',
      icon: DollarSign,
      description: 'Manage expenses and cash flow',
      enabled: hasAttendantPermission('expenses', 'view') || hasAttendantPermission('expenses', 'manage') || hasAttendantPermission('accounts', 'cashflow'),
      color: 'bg-red-500',
      subActions: [
        {
          title: 'Expenses',
          icon: DollarSign,
          description: 'Record business expenses',
          enabled: hasAttendantPermission('expenses', 'view') || hasAttendantPermission('expenses', 'manage'),
          route: '/attendant/expenses'
        },
        {
          title: 'Cash Flow',
          icon: Wallet,
          description: 'Monitor cash flow operations',
          enabled: hasAttendantPermission('accounts', 'cashflow'),
          route: '/attendant/cashflow'
        }
      ]
    },
    {
      id: 'reports',
      title: 'Reports',
      icon: BarChart3,
      description: 'View analytics and reports',
      enabled: hasAttendantPermission('reports', 'sales'),
      color: 'bg-orange-500',
      subActions: [

        {
          title: 'Profit & Loss',
          icon: TrendingUp,
          description: 'Analyze business profitability',
          enabled: hasAttendantPermission('reports', 'sales'),
          route: '/attendant/profit-loss'
        }
      ]
    }
  ];

  // Filter groups based on permissions - only show groups that have at least one enabled subAction
  const availableGroups = actionGroups.filter(group => {
    // Check if at least one subAction is enabled
    const hasEnabledSubAction = group.subActions.some(subAction => subAction.enabled);
    return hasEnabledSubAction;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
              <Store className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 truncate">Staff Dashboard</h1>
              <p className="text-xs text-gray-500 truncate">{shopName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-gray-900">{attendant?.username || 'Unknown'}</p>
              <p className="text-xs text-gray-500">PIN: {attendant?.uniqueDigits || 'N/A'}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 px-2 text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline ml-1.5">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-8 px-2 text-gray-600 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 max-w-4xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-0.5">
            Welcome back, {attendant?.username || 'User'}!
          </h2>
          <p className="text-xs text-gray-500">
            {currentTime.toLocaleDateString('en-US', { 
              weekday: 'short', 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })} · {currentTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        </div>

        {/* Feature Groups - Expandable cards */}
        <div className="space-y-3 mb-4">
          {availableGroups.map((group) => (
            <div key={group.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
              {/* Group Header */}
              <div
                className={`px-4 py-3 cursor-pointer transition-all duration-200 ${
                  group.enabled ? 'hover:bg-gray-50' : 'bg-gray-50 opacity-60'
                }`}
                onClick={() => {
                  if (group.enabled) {
                    setExpandedGroup(expandedGroup === group.id ? null : group.id);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      group.enabled ? group.color : 'bg-gray-300'
                    }`}>
                      {group.enabled ? (
                        <group.icon className="h-5 w-5 text-white" />
                      ) : (
                        <Lock className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className={`text-sm font-semibold leading-tight ${
                        group.enabled ? 'text-gray-900' : 'text-gray-500'
                      }`}>
                        {group.title}
                      </h3>
                      <p className={`text-xs truncate ${
                        group.enabled ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        {group.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {group.enabled && (
                      <span className="text-xs text-gray-400 hidden sm:block">
                        {group.subActions.filter(sub => sub.enabled).length}/{group.subActions.length}
                      </span>
                    )}
                    {group.enabled ? (
                      <div className={`transition-transform duration-200 ${
                        expandedGroup === group.id ? 'rotate-180' : ''
                      }`}>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    ) : (
                      <span className="inline-block bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded-full">
                        No Access
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expandable Sub-actions */}
              {expandedGroup === group.id && group.enabled && (
                <div className="border-t bg-gray-50 p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.subActions.filter(subAction => subAction.enabled).map((subAction, subIndex) => (
                      <div
                        key={subIndex}
                        className="bg-white rounded-lg border p-3 transition-all duration-200 cursor-pointer hover:shadow-md hover:border-blue-300 active:bg-blue-50"
                        onClick={() => setLocation(subAction.route)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${group.color}`}>
                            <subAction.icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-medium text-sm text-gray-900 leading-tight">
                              {subAction.title}
                            </h4>
                            <p className="text-xs text-gray-500 truncate">
                              {subAction.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Permission Status Summary */}
        <div className="bg-blue-50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-blue-900">Permission Status</h3>
              <p className="text-xs text-blue-700">
                {availableGroups.filter(g => g.enabled).length} of {availableGroups.length} feature groups accessible
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-blue-600">
                {Math.round((availableGroups.filter(g => g.enabled).length / availableGroups.length) * 100)}%
              </div>
              <p className="text-xs text-blue-600">Access Level</p>
            </div>
          </div>
        </div>

        {availableGroups.filter(group => group.enabled).length === 0 && (
          <Card className="mb-8">
            <CardContent className="text-center py-8">
              <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No permissions assigned</p>
              <p className="text-sm text-gray-400">Contact your administrator to request access to system features</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function AttendantDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    }>
      <AttendantDashboardContent />
    </Suspense>
  );
}