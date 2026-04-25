import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Check, CheckCircle } from "lucide-react";
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
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "One number", ok: /[0-9]/.test(password) },
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
        {!isDone ? (
          <>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Set a new password</h1>
            <p className="text-sm text-gray-500 mb-6">
              Create a strong password for your Pointify account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Requirements */}
              <ul className="space-y-1.5 pt-1">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-2 text-xs">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        c.ok ? "bg-green-500" : "bg-gray-200"
                      }`}
                    >
                      {c.ok && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <span className={c.ok ? "text-green-700" : "text-gray-400"}>{c.label}</span>
                  </li>
                ))}
              </ul>

              <button
                type="submit"
                disabled={isLoading || !isValid}
                className="w-full h-10 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition mt-1"
              >
                {isLoading ? "Updating…" : "Update password"}
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
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Password updated</h1>
            <p className="text-sm text-gray-500 mb-6">
              Your password has been changed. You can now sign in with your new credentials.
            </p>
            <button
              onClick={() => setLocation("/business-login")}
              className="w-full h-10 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition"
            >
              Go to sign in
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-8">© 2025 Pointify. All rights reserved.</p>
    </div>
  );
}
