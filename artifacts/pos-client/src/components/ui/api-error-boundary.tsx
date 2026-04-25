import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ApiErrorBoundaryProps {
  error: Error;
  onRetry?: () => void;
  title?: string;
}

export default function ApiErrorBoundary({ 
  error, 
  onRetry, 
  title = "Connection Error" 
}: ApiErrorBoundaryProps) {
  const isServerError = error.message.includes('502') || 
                       error.message.includes('503') || 
                       error.message.includes('temporarily unavailable');
  
  const isConnectionError = error.message.includes('Unable to connect') ||
                           error.message.includes('fetch') ||
                           error.message.includes('NetworkError');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription className="mt-2">
            {isServerError ? (
              "The API server is temporarily unavailable. Please check with your system administrator or try again later."
            ) : isConnectionError ? (
              "Unable to connect to the API server. Please verify your network connection and that the server is running."
            ) : (
              error.message
            )}
          </AlertDescription>
        </Alert>
        
        {onRetry && (
          <Button 
            onClick={onRetry} 
            className="w-full"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
        
        <div className="mt-4 text-sm text-gray-600 text-center">
          <p>If this problem persists, please contact your system administrator.</p>
        </div>
      </div>
    </div>
  );
}