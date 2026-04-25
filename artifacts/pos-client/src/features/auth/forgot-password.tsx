import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS, apiCall } from "@/lib/api-config";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const { toast } = useToast();

  const sendReset = async (addr: string) => {
    setIsLoading(true);
    try {
      await apiCall(API_ENDPOINTS.auth.requestPasswordReset, {
        method: "POST",
        body: JSON.stringify({ email: addr }),
      });
      setIsEmailSent(true);
    } catch (error) {
      toast({
        title: "Could not send reset email",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendReset(email);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center">
          <div className="w-3.5 h-3.5 bg-white rounded-full" />
        </div>
        <span className="text-xl font-bold text-gray-900 tracking-tight">Pointify</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        {!isEmailSent ? (
          <>
            <button
              onClick={() => setLocation("/business-login")}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mb-5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </button>

            <h1 className="text-xl font-semibold text-gray-900 mb-1">Reset your password</h1>
            <p className="text-sm text-gray-500 mb-6">
              Enter your email and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition"
              >
                {isLoading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-gray-500">
              Remember your password?{" "}
              <button
                onClick={() => setLocation("/business-login")}
                className="text-purple-600 font-semibold hover:underline"
              >
                Sign in
              </button>
            </p>
          </>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Check your inbox</h1>
            <p className="text-sm text-gray-500 mb-1">We sent a reset link to</p>
            <p className="text-sm font-semibold text-gray-800 mb-6">{email}</p>

            <p className="text-xs text-gray-400 mb-4">
              Didn't get it? Check your spam folder or resend.
            </p>

            <button
              onClick={() => sendReset(email)}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mx-auto mb-5 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isLoading ? "Resending…" : "Resend email"}
            </button>

            <button
              onClick={() => setLocation("/business-login")}
              className="w-full h-10 border border-gray-200 hover:border-purple-300 text-gray-700 text-sm font-medium rounded-lg transition"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-8">© 2025 Pointify. All rights reserved.</p>
    </div>
  );
}
