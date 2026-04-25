import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Download, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/features/auth/useAuth';

interface SyncProgress {
  entity: string;
  total: number;
  synced: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
}

interface SyncStatusData {
  needsSync: boolean;
  progress: SyncProgress[];
}

export function SyncStatus() {
  const { admin } = useAuth();
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Check sync status
  const { data: syncStatus, refetch: refetchSyncStatus } = useQuery<SyncStatusData>({
    queryKey: ['/api/sync/status'],
    refetchInterval: isManualSyncing ? 2000 : 30000, // Faster polling during sync
  });

  // Manual sync mutation
  const manualSyncMutation = useMutation({
    mutationFn: async () => {
      const adminId = admin?._id || admin?.id;
      const primaryShopId = admin?.primaryShop;

      return await apiRequest('/api/sync/initial', {
        method: 'POST',
        body: JSON.stringify({ 
          adminId, 
          shopId: primaryShopId 
        })
      });
    },
    onMutate: () => {
      setIsManualSyncing(true);
    },
    onSuccess: (result) => {
      console.log('Manual sync completed:', result);
      // Invalidate all queries to refresh with synced data
      queryClient.invalidateQueries();
      refetchSyncStatus();
      setIsManualSyncing(false);
    },
    onError: (error) => {
      console.error('Manual sync failed:', error);
      setIsManualSyncing(false);
    }
  });

  const handleManualSync = () => {
    manualSyncMutation.mutate();
  };

  const getStatusIcon = (needsSync: boolean, isSyncing: boolean) => {
    if (isSyncing) {
      return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    }
    if (needsSync) {
      return <AlertCircle className="h-4 w-4 text-orange-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = (needsSync: boolean, isSyncing: boolean) => {
    if (isSyncing) return 'Syncing...';
    if (needsSync) return 'Sync Needed';
    return 'Up to Date';
  };

  const getStatusVariant = (needsSync: boolean, isSyncing: boolean): "default" | "secondary" | "destructive" | "outline" => {
    if (isSyncing) return 'default';
    if (needsSync) return 'destructive';
    return 'secondary';
  };

  // Don't show if user is not authenticated
  if (!admin) {
    return null;
  }

  const isSyncing = isManualSyncing || manualSyncMutation.isPending;
  const needsSync = syncStatus?.needsSync || false;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="h-5 w-5" />
              Data Sync Status
            </CardTitle>
            <CardDescription>
              Keep your local data in sync with online
            </CardDescription>
          </div>
          <Badge variant={getStatusVariant(needsSync, isSyncing)}>
            {getStatusIcon(needsSync, isSyncing)}
            {getStatusText(needsSync, isSyncing)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {needsSync && !isSyncing && (
          <Alert>
            <AlertDescription>
              Your local database needs to be synced with online data. Click "Sync Now" to download the latest information.
            </AlertDescription>
          </Alert>
        )}

        {isSyncing && syncStatus?.progress && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Sync Progress</h4>
            <div className="grid grid-cols-2 gap-2">
              {syncStatus.progress
                .filter(item => item.status !== 'pending' || item.total > 0)
                .slice(0, 6) // Show first 6 entities
                .map((item) => (
                <div key={item.entity} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                  <div className="flex items-center gap-2">
                    {item.status === 'completed' ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : item.status === 'syncing' ? (
                      <Clock className="h-3 w-3 text-blue-500 animate-spin" />
                    ) : (
                      <Clock className="h-3 w-3 text-gray-400" />
                    )}
                    <span className="capitalize">{item.entity}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {item.synced}/{item.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={handleManualSync}
            disabled={isSyncing}
            size="sm"
            className="flex-1"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
          
          {!isSyncing && (
            <Button 
              onClick={() => refetchSyncStatus()}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!needsSync && !isSyncing && (
          <p className="text-sm text-gray-500">
            Last checked: {new Date().toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}