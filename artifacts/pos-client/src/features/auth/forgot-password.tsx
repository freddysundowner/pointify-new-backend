import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Mail, CheckCircle, RotateCcw } from "lucide-react";
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
        description:
          error instanceof Error ? error.message : "Please try again.",
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
    <div className="min-h-screen flex">
      {/* Left accent panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-purple-600 flex-col justify-center p-16 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500 rounded-full opacity-40" />
          <div className="absolute bottom-8 -left-16 w-64 h-64 bg-purple-700 rounded-full opacity-30" />
        </div>
        <div className="relative z-10">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-8">
            <Mail className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Reset your password</h2>
          <p className="text-purple-200 text-base leading-relaxed">
            No worries — it happens. Just enter your email and we'll send you a link to get back in.
          </p>
        </div>
        {/* Logo */}
        <div className="absolute bottom-10 left-16 flex items-center gap-2 z-10">
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
            <div className="w-3 h-3 bg-purple-600 rounded-full" />
          </div>
          <span className="text-white font-semibold">Pointify</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm">
          <button
            onClick={() => setLocation("/business-login")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </button>

          {!isEmailSent ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Forgot your password?</h1>
              <p className="text-gray-500 text-sm mb-8">
                Enter your email and we'll send reset instructions.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="you@business.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-gray-800 placeholder-gray-300 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  {isLoading ? (
                    "Sending…"
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-8 text-center text-sm text-gray-500">
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
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your inbox</h1>
              <p className="text-gray-500 text-sm mb-2">
                We sent reset instructions to
              </p>
              <p className="font-semibold text-gray-800 mb-8">{email}</p>

              <div className="bg-gray-50 rounded-2xl p-5 text-left space-y-3 mb-8">
                {[
                  "Check your inbox (and spam folder)",
                  "Click the reset link in the email",
                  "Create a new password",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-600">{step}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => sendReset(email)}
                disabled={isLoading}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mx-auto transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                {isLoading ? "Resending…" : "Resend email"}
              </button>

              <button
                onClick={() => setLocation("/business-login")}
                className="mt-6 w-full h-12 border border-gray-200 hover:border-purple-300 text-gray-700 font-medium rounded-xl transition-all text-sm"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-300 mt-12">© 2025 Pointify. All rights reserved.</p>
      </div>
    </div>
  );
}
