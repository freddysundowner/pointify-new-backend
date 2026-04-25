import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, ArrowRight, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "./useAuth";

export default function BusinessLogin() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      toast({ title: "Welcome back!", description: "Signed in to Pointify." });
      setLocation("/");
    } catch (error) {
      toast({
        title: "Sign in failed",
        description:
          error instanceof Error
            ? error.message
            : "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-purple-600 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-purple-500 rounded-full opacity-40" />
          <div className="absolute bottom-10 -left-16 w-64 h-64 bg-purple-700 rounded-full opacity-30" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <div className="w-4 h-4 bg-purple-600 rounded-full" />
          </div>
          <span className="text-white text-xl font-bold">Pointify</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Run your business<br />with confidence.
          </h2>
          <p className="text-purple-200 text-lg mb-10">
            Manage sales, inventory, staff, and reports — all in one place.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {["Sales tracking", "Inventory", "Staff management", "Reports"].map((f) => (
              <span
                key={f}
                className="bg-white/20 text-white text-sm px-4 py-1.5 rounded-full backdrop-blur-sm"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
          <p className="text-white/90 text-sm leading-relaxed italic mb-3">
            "Pointify transformed how we manage our shop. Sales reporting alone saves us hours every week."
          </p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-300 rounded-full flex items-center justify-center text-purple-800 font-bold text-xs">
              KA
            </div>
            <div>
              <p className="text-white text-sm font-medium">Kofi Asante</p>
              <p className="text-purple-300 text-xs">Owner, Asante Grocery</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-purple-600 rounded-xl flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full" />
            </div>
            <span className="text-gray-900 text-lg font-bold">Pointify</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-gray-500 mb-8 text-sm">Sign in to your business account</p>

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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setLocation("/forgot-password")}
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all mt-2"
            >
              {isLoading ? (
                "Signing in…"
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Don't have an account?{" "}
            <button
              onClick={() => setLocation("/signup")}
              className="text-purple-600 font-semibold hover:underline"
            >
              Create one
            </button>
          </p>

          <button
            onClick={() => setLocation("/login")}
            className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Store className="w-4 h-4" />
            Switch to Attendant login
          </button>
        </div>

        <p className="text-xs text-gray-300 mt-12">© 2025 Pointify. All rights reserved.</p>
      </div>
    </div>
  );
}
