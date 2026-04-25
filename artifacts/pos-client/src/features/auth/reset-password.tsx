import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Lock, ArrowRight, Check, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS, apiCall } from "@/lib/api-config";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get("token");
    if (resetToken) {
      setToken(resetToken);
    } else {
      toast({
        title: "Invalid Reset Link",
        description: "This password reset link is invalid or expired.",
        variant: "destructive",
      });
      setLocation("/forgot-password");
    }
  }, []);

  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "A number", ok: /[0-9]/.test(password) },
    { label: "Passwords match", ok: password === confirmPassword && password.length > 0 },
  ];

  const isValid = checks.every((c) => c.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setIsLoading(true);
    try {
      await apiCall(API_ENDPOINTS.auth.resetPassword, {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setIsDone(true);
    } catch (error) {
      toast({
        title: "Reset Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to reset password. Please request a new link.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Create a new password</h2>
          <p className="text-purple-200 text-base leading-relaxed">
            Choose a strong password that you haven't used before. Keep it safe and don't share it with anyone.
          </p>
        </div>
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
          {!isDone ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Set new password</h1>
              <p className="text-gray-500 text-sm mb-8">
                Create a strong password for your Pointify account.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      className="w-full h-12 px-4 pr-12 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-gray-800 placeholder-gray-300 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Same password again"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full h-12 px-4 pr-12 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-gray-800 placeholder-gray-300 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Requirements */}
                <div className="grid grid-cols-2 gap-2">
                  {checks.map((c) => (
                    <div
                      key={c.label}
                      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all ${
                        c.ok
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-50 text-gray-400"
                      }`}
                    >
                      {c.ok ? (
                        <Check className="w-3 h-3 shrink-0" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border border-gray-300 shrink-0" />
                      )}
                      {c.label}
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !isValid}
                  className="w-full h-12 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all mt-2"
                >
                  {isLoading ? (
                    "Updating…"
                  ) : (
                    <>
                      Update Password
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
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Password updated!</h1>
              <p className="text-gray-500 text-sm mb-8">
                Your password has been changed successfully. You can now sign in with your new password.
              </p>
              <button
                onClick={() => setLocation("/business-login")}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                Go to Login
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-300 mt-12">© 2025 Pointify. All rights reserved.</p>
      </div>
    </div>
  );
}
