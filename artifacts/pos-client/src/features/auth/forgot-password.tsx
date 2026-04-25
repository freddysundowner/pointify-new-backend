import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS, apiCall } from "@/lib/api-config";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const data = await apiCall(API_ENDPOINTS.auth.requestPasswordReset, {
        method: "POST",
        body: JSON.stringify({
          email: email,
        }),
      });

      setIsEmailSent(true);
      toast({
        title: "Reset Email Sent",
        description: "Check your email for password reset instructions.",
        action: <CheckCircle className="w-4 h-4" />,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send reset email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setIsLoading(true);
    try {
      const data = await apiCall(API_ENDPOINTS.auth.requestPasswordReset, {
        method: "POST",
        body: JSON.stringify({
          email: email,
        }),
      });

      toast({
        title: "Email Resent",
        description: "Password reset email has been sent again.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resend email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => setLocation("/business-login")}
          className="mb-6 text-gray-600 hover:text-purple-600"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to login
        </Button>

        {/* Reset Password Card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center">
              <Mail className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                {isEmailSent ? "Check Your Email" : "Reset Password"}
              </CardTitle>
              <CardDescription className="text-gray-600 mt-2">
                {isEmailSent 
                  ? "We've sent password reset instructions to your email address"
                  : "Enter your email address and we'll send you instructions to reset your password"
                }
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {!isEmailSent ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send Reset Instructions"}
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <h3 className="font-semibold text-green-800 mb-2">Email Sent Successfully!</h3>
                  <p className="text-sm text-green-700">
                    We've sent password reset instructions to <strong>{email}</strong>
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-gray-600 text-center">
                    Didn't receive the email? Check your spam folder or try again.
                  </p>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResendEmail}
                    className="w-full h-12"
                    disabled={isLoading}
                  >
                    {isLoading ? "Resending..." : "Resend Email"}
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Remember your password?{" "}
                <Button
                  variant="link"
                  onClick={() => setLocation("/business-login")}
                  className="text-purple-600 hover:text-purple-700 p-0 h-auto font-medium"
                >
                  Sign in here
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            © 2025 Pointify. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}