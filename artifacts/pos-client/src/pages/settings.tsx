import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Settings, Globe, CheckCircle2, AlertCircle, Wifi, WifiOff, RefreshCw, Clock } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useAuth } from "@/features/auth/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { API_ENDPOINTS, apiCall } from "@/lib/api-config";

export default function SettingsPage() {
  const { admin,token } = useAuth();
  const { toast } = useToast();
  const [selectedMode, setSelectedMode] = useState<'online' | 'offline' | 'hybrid'>('hybrid');
  const [syncInterval, setSyncInterval] = useState<number>(120000); // Default 2 min
  const [autoPrint, setAutoPrint] = useState<boolean>(false); // NEW auto print state

  // Fetch current settings
  const { data: settingsData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['settings', admin?._id],
    queryFn: async () => {
      const response = await fetch(`/api/settings?adminId=${admin?._id}`);
      const data = await response.json();
      return data;
    },
    enabled: !!admin?._id,
  });
  const manualSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiCall(`/api/sync/${admin?._id}?force=true`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Manual sync failed');
      return data;
    },

    onSuccess: (data) => {
      toast({
        title: "Manual Sync Started",
        description: data.message || "Manual sync has started successfully.",
      });
      // Invalidate all queries to refresh with synced data
      queryClient.invalidateQueries({ refetchActive: true });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });
  
  console.log("Settings Data:", settingsData);
  // Load settings data
  useEffect(() => {
    if (settingsData?.success && settingsData?.data) {
      setSelectedMode(settingsData.data.apiMode || 'hybrid');
      setSyncInterval(settingsData.data.syncInterval || 120000);
      setAutoPrint(settingsData.data.autoPrint || false); // NEW
    }
  }, [settingsData]);

  // Helpers
  const millisecondsToMinutes = (ms: number) => Math.floor(ms / 60000);
  const minutesToMilliseconds = (minutes: number) => minutes * 60000;

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { apiMode: 'online' | 'offline' | 'hybrid', syncInterval: number, autoPrint: boolean }) => {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: admin?._id,
          apiMode: settings.apiMode,
          syncInterval: settings.syncInterval,
          autoPrint: settings.autoPrint
        })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to update settings');
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Settings Updated",
        description: data.message || `API mode set to ${data.data.apiMode}`,
      });
      queryClient.invalidateQueries({ queryKey: ['settings',`/api/auth/admin/${admin?._id}`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      apiMode: selectedMode,
      syncInterval: syncInterval,
      autoPrint: autoPrint
    });
  };

  const currentSettings = settingsData?.data;
  const isUpdating = updateSettingsMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Settings className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500">System configuration and status</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings Config */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-lg">API Mode Configuration</CardTitle>
              </div>
              <CardDescription>
                Choose how the system handles API requests and sync
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup value={selectedMode} onValueChange={setSelectedMode}>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="online" id="online" />
                    <Label htmlFor="online" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Wifi className="w-4 h-4 text-green-500" />
                        <div>
                          <div className="font-medium">Online Mode</div>
                          <div className="text-sm text-gray-500">Always use online API, no local fallback</div>
                        </div>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="offline" id="offline" />
                    <Label htmlFor="offline" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <WifiOff className="w-4 h-4 text-red-500" />
                        <div>
                          <div className="font-medium">Offline Mode</div>
                          <div className="text-sm text-gray-500">Use local API only, no online calls or sync</div>
                        </div>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="hybrid" id="hybrid" />
                    <Label htmlFor="hybrid" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <RefreshCw className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="font-medium">Hybrid Mode</div>
                          <div className="text-sm text-gray-500">Online first with automatic local fallback</div>
                        </div>
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-600" />
                  <Label htmlFor="syncInterval" className="text-sm font-medium">
                    Sync Interval (Minutes)
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    id="syncInterval"
                    type="number"
                    min="1"
                    max="10"
                    value={millisecondsToMinutes(syncInterval)}
                    onChange={(e) => {
                      const minutes = parseInt(e.target.value) || 2;
                      setSyncInterval(minutesToMilliseconds(minutes));
                    }}
                    className="w-20"
                  />
                  <span className="text-sm text-gray-500">
                    minutes (Auto-sync every {millisecondsToMinutes(syncInterval)} min)
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  How often to sync data between online and offline. Range: 1-10 min.
                </div>
              </div>

              {/* ✅ NEW AUTO PRINT */}
              <div className="flex items-center gap-3 mt-4">
                <input
                  id="autoPrint"
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => setAutoPrint(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="autoPrint" className="text-sm font-medium text-gray-700">
                  Enable Auto Print
                </Label>
              </div>
              <div className="text-xs text-gray-500 ml-7">
                Automatically print receipt after transaction completes.
              </div>

              <Button 
                onClick={handleSaveSettings}
                disabled={isUpdating || isLoadingSettings}
                className="w-full"
              >
                {isUpdating ? "Updating..." : "Save Settings"}
              </Button>
            </CardContent>
          </Card>

          {/* Current Status */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <CardTitle className="text-lg">Current Status</CardTitle>
              </div>
              <CardDescription>
                Current system configuration and sync status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingSettings ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between py-3 px-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="font-medium text-blue-900">
                          {currentSettings?.apiMode === 'online' ? 'Online Mode' : 
                           currentSettings?.apiMode === 'offline' ? 'Offline Mode' : 'Hybrid Mode'}
                        </div>
                        <div className="text-sm text-blue-700">
                          {currentSettings?.apiMode === 'online' ? 'Direct online API only' : 
                           currentSettings?.apiMode === 'offline' ? 'Local API only' : 'Online with local fallback'}
                        </div>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200">
                      Active
                    </Badge>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => manualSyncMutation.mutate()}
                      disabled={manualSyncMutation.isPending}
                      className="w-full"
                    >
                      {manualSyncMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Manual Sync Now
                        </>
                      )}
                    </Button>


                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium text-gray-700">Sync Timer</span>
                      <div className="flex items-center gap-2">
                        {currentSettings?.syncEnabled ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Enabled</Badge>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <Badge variant="default" className="bg-red-100 text-red-800 border-red-200">Disabled</Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium text-gray-700">Sync Interval</span>
                      <Badge variant="default" className="bg-gray-100 text-gray-800 border-gray-200">
                        {currentSettings?.syncInterval ? `${currentSettings.syncInterval / 1000}s` : '120s'}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">
                      <strong>Current Mode:</strong> {' '}
                      {currentSettings?.apiMode === 'online' ? 'All API calls go directly to online server.' : 
                       currentSettings?.apiMode === 'offline' ? 'All API calls use local server only. Sync is disabled.' : 
                       'System tries online API first, falls back to local on network errors.'}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Simple System Status */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <CardTitle className="text-lg">System Status</CardTitle>
              </div>
              <CardDescription>
                Current system health and operational status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-gray-700">API Routing</span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Operational</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-gray-700">Authentication</span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Ready</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-gray-700">Configuration</span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Simplified</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
