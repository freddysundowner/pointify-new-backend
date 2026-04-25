import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS, apiCall } from "@/lib/api-config";
import { useAuth } from "./useAuth";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    ownerName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    affliate: "",
  });
  const { toast } = useToast();
  const { login } = useAuth();

  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (formData.password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await apiCall(API_ENDPOINTS.auth.register, {
        method: "POST",
        body: JSON.stringify({
          name: formData.ownerName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          ...(formData.affliate.trim() && { affliate: formData.affliate.trim() }),
        }),
      });
      await login(formData.email, formData.password);
    } catch (error) {
      toast({
        title: "Registration failed",
        description:
          error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-10">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center">
          <div className="w-3.5 h-3.5 bg-white rounded-full" />
        </div>
        <span className="text-xl font-bold text-gray-900 tracking-tight">Pointify</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Create your account</h1>
        <p className="text-sm text-gray-500 mb-6">
          Start managing your business with Pointify.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Phone side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ownerName" className="block text-sm font-medium text-gray-700 mb-1.5">
                Full name
              </label>
              <input
                id="ownerName"
                type="text"
                autoComplete="name"
                placeholder="Sarah Mensah"
                value={formData.ownerName}
                onChange={(e) => update("ownerName", e.target.value)}
                required
                autoFocus
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+233 24 000 0000"
                value={formData.phone}
                onChange={(e) => update("phone", e.target.value)}
                required
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={formData.email}
              onChange={(e) => update("email", e.target.value)}
              required
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={formData.password}
                onChange={(e) => update("password", e.target.value)}
                required
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

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Same password again"
                value={formData.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
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
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
            )}
          </div>

          {/* Referral code toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowReferral(!showReferral)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-600 transition-colors"
            >
              {showReferral ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showReferral ? "Hide referral code" : "Have a referral code?"}
            </button>
            {showReferral && (
              <div className="mt-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Enter referral code"
                  value={formData.affliate}
                  onChange={(e) => update("affliate", e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition mt-1"
          >
            {isLoading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="mt-5 pt-5 border-t border-gray-100 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <button
            onClick={() => setLocation("/business-login")}
            className="text-purple-600 font-semibold hover:underline"
          >
            Sign in
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-8">© 2025 Pointify. All rights reserved.</p>
    </div>
  );
}
