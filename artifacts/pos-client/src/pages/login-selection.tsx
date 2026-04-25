import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { User, Users, MapPin } from 'lucide-react';

export default function LoginSelection() {
  const [, setLocation] = useLocation();

  // Check localStorage on component mount and auto-redirect
  useEffect(() => {
    const attendantData = localStorage.getItem('attendantData');
    const adminData = localStorage.getItem('adminData') || localStorage.getItem('authToken');
    
    if (attendantData) {
      // Attendant is logged in - check if they have can_sell permission
      try {
        const attendant = JSON.parse(attendantData);
        const hasCanSell = attendant.permissions?.some((p: any) => 
          p.key === 'pos' && p.value?.includes('can_sell')
        );
        
        if (hasCanSell) {
          setLocation('/attendant/pos');
        } else {
          setLocation('/attendant/dashboard');
        }
        return;
      } catch {
        setLocation('/attendant/dashboard');
        return;
      }
    }
    
    if (adminData) {
      // Admin data exists - go to business login or dashboard
      setLocation('/dashboard');
      return;
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
              <div className="w-6 h-6 bg-purple-600 rounded-full"></div>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Pointify</h1>
          <p className="text-gray-600 text-lg">An enterprise at your hand.</p>
        </div>

        {/* Login Options */}
        <div className="space-y-4">
          {/* Business Owner Login */}
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-purple-200">
            <CardContent className="p-0">
              <Button
                variant="ghost"
                className="w-full h-16 text-left justify-start px-6 hover:bg-transparent"
                onClick={() => setLocation('/business-login')}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <User className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg text-purple-600">BUSINESS OWNER</div>
                    <div className="text-sm text-gray-500">Access admin dashboard and management tools</div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Attendant Login */}
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-purple-200 bg-purple-600 text-white">
            <CardContent className="p-0">
              <Button
                variant="ghost"
                className="w-full h-16 text-left justify-start px-6 hover:bg-purple-700 text-white"
                onClick={() => setLocation('/attendant/login')}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg">ATTENDANT</div>
                    <div className="text-sm text-purple-200">Staff access with assigned permissions</div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Divider */}
          <div className="text-center my-8">
            <span className="text-gray-400 text-sm">or</span>
          </div>

          {/* Shops Around You */}
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-gray-200">
            <CardContent className="p-0">
              <Button
                variant="ghost"
                className="w-full h-12 text-left justify-start px-6 hover:bg-gray-50"
                onClick={() => {
                  // This could link to a public shop directory or customer portal
                  window.open('https://pointifypos.com/shops', '_blank');
                }}
              >
                <div className="flex items-center space-x-3">
                  <MapPin className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-700 font-medium">Shops Around You</span>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-gray-500">
          <p>Need help? Contact support</p>
        </div>
      </div>
    </div>
  );
}