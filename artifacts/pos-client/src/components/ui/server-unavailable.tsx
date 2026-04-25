import { AlertTriangle, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ServerUnavailableProps {
  onRetry?: () => void;
  showRetry?: boolean;
}

export default function ServerUnavailable({ 
  onRetry, 
  showRetry = true 
}: ServerUnavailableProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Server Unavailable</h1>
          <p className="text-gray-600">
            The API server is currently unavailable (502 Bad Gateway). This indicates a temporary server issue.
          </p>
        </div>

        <Alert variant="destructive">
          <Settings className="h-4 w-4" />
          <AlertTitle>Server Status</AlertTitle>
          <AlertDescription>
            The staging API server at staging.pointifypos.com is not responding. 
            Please check with your system administrator or try again later.
          </AlertDescription>
        </Alert>
        
        {showRetry && onRetry && (
          <Button 
            onClick={onRetry} 
            className="w-full"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Check Server Status
          </Button>
        )}
        
        <div className="text-sm text-gray-500 text-center space-y-2">
          <p>This is a server-side issue that requires administrative attention.</p>
          <p>No data will be lost - your information is safely stored.</p>
        </div>
      </div>
    </div>
  );
}