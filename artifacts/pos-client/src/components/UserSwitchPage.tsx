import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, LogOut, ArrowLeft } from 'lucide-react';
import { useAttendantAuth } from '@/contexts/AttendantAuthContext';

interface UserSwitchPageProps {
  targetRoute: string;
}

export default function UserSwitchPage({ targetRoute }: UserSwitchPageProps) {
  const [, setLocation] = useLocation();
  const { attendant, logout: logoutAttendant } = useAttendantAuth();

  const handleSwitchToAdmin = () => {
    // Clear attendant session and redirect to business login
    logoutAttendant();
    setLocation('/business-login');
  };

  const handleBackToAttendant = () => {
    // Go back to attendant dashboard
    setLocation('/attendant/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-purple-600 rounded-full"></div>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Access Required</h1>
          <p className="text-gray-600">You need admin access to view this page</p>
        </div>

        {/* Current User Info */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Currently logged in as:</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">{attendant?.username || 'Attendant'}</div>
                <div className="text-sm text-gray-500">Staff Member • PIN: {attendant?.uniqueDigits}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Options */}
        <div className="space-y-3">
          <Button
            onClick={handleSwitchToAdmin}
            className="w-full h-12 bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Switch to Business Owner Login
          </Button>

          <Button
            onClick={handleBackToAttendant}
            variant="outline"
            className="w-full h-12"
            size="lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Attendant Dashboard
          </Button>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Admin access required:</strong> The page you're trying to access ({targetRoute}) requires business owner permissions. Please switch to a business owner account to continue.
          </p>
        </div>
      </div>
    </div>
  );
}