import { useState, Suspense } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, User, Lock, Store, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ENDPOINTS } from '@/lib/api-endpoints';
import { useAttendantAuth } from '@/contexts/AttendantAuthContext';

interface AttendantLoginForm {
  pin: string;
  shopId: string;
}

function AttendantLoginContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAttendantAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<AttendantLoginForm>({
    pin: '',
    shopId: ''
  });

  const loginMutation = useMutation({
    mutationFn: async (data: AttendantLoginForm) => {
      const response = await fetch(ENDPOINTS.auth.attendantLogin, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin: data.pin, shopId: data.shopId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      // Use the attendant auth context to handle login
      login(data.attendant, data.token, data?.shopData || {});
      
      toast({
        title: "Login Successful", 
        description: `Welcome back, ${data.attendant.username}!`
      });
      
      // Check if attendant has can_sell permission and redirect to POS directly
      const hasCanSell = data.attendant.permissions?.some((p: any) => 
        p.key === 'pos' && p.value?.includes('can_sell')
      );
      
      if (hasCanSell) {
        console.log('Attendant has can_sell permission - redirecting to POS after login');
        sessionStorage.setItem('attendantLoginRedirect', 'true');
        setLocation('/attendant/pos');
      } else {
        // Fallback to dashboard if no can_sell permission
        setLocation('/attendant/dashboard');
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid PIN or Shop ID. Please check your credentials.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.pin || !formData.shopId) {
      toast({
        title: "Missing Information",
        description: "Please enter both your PIN and Shop ID.",
        variant: "destructive"
      });
      return;
    }

    loginMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof AttendantLoginForm) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="text-purple-600 hover:text-purple-800 hover:bg-purple-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login Options
          </Button>
        </div>
        
        <Card className="shadow-lg border-purple-100">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mb-4">
              <div className="w-6 h-6 bg-white rounded-full"></div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              <span className="text-purple-600">P</span>ointify Staff
            </CardTitle>
            <CardDescription className="text-purple-600">
              Enter your PIN and Shop ID to access the system
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* PIN Input */}
              <div className="space-y-2">
                <Label htmlFor="pin" className="text-sm font-medium text-purple-700">
                  Staff PIN
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400 h-4 w-4" />
                  <Input
                    id="pin"
                    type="text"
                    placeholder="Enter your PIN"
                    value={formData.pin}
                    onChange={handleInputChange('pin')}
                    className="pl-10 h-12 border-purple-200 focus:border-purple-500 focus:ring-purple-500"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Shop ID Input */}
              <div className="space-y-2">
                <Label htmlFor="shopId" className="text-sm font-medium text-purple-700">
                  Shop ID
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400 h-4 w-4" />
                  <Input
                    id="shopId"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your Shop ID"
                    value={formData.shopId}
                    onChange={handleInputChange('shopId')}
                    className="pl-10 pr-10 h-12 border-purple-200 focus:border-purple-500 focus:ring-purple-500"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-400 hover:text-purple-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-medium"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            {/* Help Text */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Need help? Contact your administrator
              </p>
              <p className="text-xs text-gray-400 mt-1">
                PIN: Your staff PIN · Shop ID: Your numeric shop identifier
              </p>
            </div>


          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AttendantLogin() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AttendantLoginContent />
    </Suspense>
  );
}