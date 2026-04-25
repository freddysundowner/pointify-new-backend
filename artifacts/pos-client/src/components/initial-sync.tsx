import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Clock, Download } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface SyncProgress {
  entity: string;
  total: number;
  synced: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
}

interface InitialSyncResult {
  success: boolean;
  totalEntities: number;
  syncedEntities: number;
  failedEntities: string[];
  progress: SyncProgress[];
}

interface InitialSyncProps {
  adminId?: string;
  shopId?: string;
  onComplete?: () => void;
}

export function InitialSync({ adminId, shopId, onComplete }: InitialSyncProps) {
  const [issyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<InitialSyncResult | null>(null);

  // Check if sync is needed
  const { data: syncStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/sync/status'],
    enabled: !issyncing
  });

  // Get sync progress
  const { data: progress = [], refetch: refetchProgress } = useQuery({
    queryKey: ['/api/sync/progress'],
    enabled: issyncing,
    refetchInterval: 1000 // Refresh every second during sync
  });

  // Initial sync mutation
  const initialSyncMutation = useMutation({
    mutationFn: async (data: { adminId?: string; shopId?: string }) => {
      return await apiRequest('/api/sync/initial', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (result) => {
      setSyncResult(result.result);
      setIsSyncing(false);
      onComplete?.();
    },
    onError: (error) => {
      console.error('Initial sync failed:', error);
      setIsSyncing(false);
    }
  });

  // Shop-specific sync mutation
  const shopSyncMutation = useMutation({
    mutationFn: async (data: { adminId: string; shopId: string }) => {
      return await apiRequest('/api/sync/shop', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (result) => {
      setSyncResult(result.result);
      setIsSyncing(false);
      onComplete?.();
    },
    onError: (error) => {
      console.error('Shop sync failed:', error);
      setIsSyncing(false);
    }
  });

  const handleStartSync = () => {
    setIsSyncing(true);
    setSyncResult(null);
    
    if (adminId && shopId) {
      shopSyncMutation.mutate({ adminId, shopId });
    } else {
      initialSyncMutation.mutate({ adminId, shopId });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'syncing':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getProgressPercentage = (item: SyncProgress) => {
    if (item.total === 0) return 0;
    return (item.synced / item.total) * 100;
  };

  const overallProgress = progress.length > 0 
    ? (progress.filter(p => p.status === 'completed').length / progress.length) * 100
    : 0;

  // Don't show component if sync is not needed
  if (syncStatus && !syncStatus.needsSync && !issyncing && !syncResult) {
    return null;
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Initial Data Sync
        </CardTitle>
        <CardDescription>
          Sync your data from online to local database for offline use
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {syncStatus?.needsSync && !issyncing && !syncResult && (
          <Alert>
            <AlertDescription>
              Your local database is empty. Click "Start Sync" to download your data from online.
            </AlertDescription>
          </Alert>
        )}

        {!issyncing && !syncResult && (
          <Button 
            onClick={handleStartSync}
            disabled={initialSyncMutation.isPending || shopSyncMutation.isPending}
            className="w-full"
          >
            {initialSyncMutation.isPending || shopSyncMutation.isPending 
              ? 'Starting Sync...' 
              : 'Start Sync'
            }
          </Button>
        )}

        {issyncing && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{Math.round(overallProgress)}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Syncing Entities</h4>
              <div className="space-y-2">
                {progress.map((item) => (
                  <div key={item.entity} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(item.status)}
                      <span className="capitalize">{item.entity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {item.synced}/{item.total}
                      </span>
                      {item.total > 0 && (
                        <Progress 
                          value={getProgressPercentage(item)} 
                          className="h-1 w-20" 
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {syncResult && (
          <div className="space-y-4">
            <Alert className={syncResult.success ? 'border-green-500' : 'border-yellow-500'}>
              <AlertDescription>
                {syncResult.success 
                  ? `Sync completed successfully! ${syncResult.syncedEntities}/${syncResult.totalEntities} entities synced.`
                  : `Sync completed with some issues. ${syncResult.syncedEntities}/${syncResult.totalEntities} entities synced successfully.`
                }
              </AlertDescription>
            </Alert>

            {syncResult.failedEntities.length > 0 && (
              <Alert className="border-red-500">
                <AlertDescription>
                  Failed to sync: {syncResult.failedEntities.join(', ')}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <h4 className="font-medium">Sync Results</h4>
              <div className="space-y-2">
                {syncResult.progress.map((item) => (
                  <div key={item.entity} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(item.status)}
                      <span className="capitalize">{item.entity}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {item.synced}/{item.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              onClick={() => {
                setSyncResult(null);
                refetchStatus();
              }}
              variant="outline"
              className="w-full"
            >
              Done
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}