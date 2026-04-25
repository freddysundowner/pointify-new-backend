import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS, apiCall } from "@/lib/api-config";
import { useAuth } from "./useAuth";

const STEPS = [
  { id: 1, question: "What's your name?", hint: "We'll use this to personalise your account." },
  { id: 2, question: "What's your email?", hint: "This will be your login and contact email." },
  { id: 3, question: "Your phone number?", hint: "For account security and important updates." },
  { id: 4, question: "Create a password", hint: "At least 8 characters. Make it strong!" },
  { id: 5, question: "Almost done!", hint: "Review your details and create your account." },
];

export default function Signup() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
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

  const canAdvance = () => {
    if (step === 1) return formData.ownerName.trim().length >= 2;
    if (step === 2) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
    if (step === 3) return formData.phone.trim().length >= 7;
    if (step === 4)
      return (
        formData.password.length >= 8 &&
        formData.password === formData.confirmPassword
      );
    return acceptTerms;
  };

  const next = () => {
    if (step < 5 && canAdvance()) setStep((s) => s + 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") next();
  };

  const handleSubmit = async () => {
    if (!acceptTerms) {
      toast({
        title: "Terms Required",
        description: "Please accept the terms and conditions to continue.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      await apiCall(API_ENDPOINTS.auth.register, {
        method: "POST",
        body: JSON.stringify({
          name: formData.ownerName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          ...(formData.affliate && { affliate: formData.affliate }),
        }),
      });
      toast({
        title: "Account Created!",
        description: "Welcome to Pointify. Please verify your email when you're ready.",
      });
      await login(formData.email, formData.password);
    } catch (error) {
      toast({
        title: "Registration Failed",
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const current = STEPS[step - 1];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button
          onClick={() =>
            step === 1 ? setLocation("/business-login") : setStep((s) => s - 1)
          }
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 1 ? "Back to login" : "Back"}
        </button>

        <div className="flex items-center gap-1.5">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`rounded-full transition-all duration-300 ${
                s.id < step
                  ? "w-6 h-2 bg-purple-600"
                  : s.id === step
                  ? "w-6 h-2 bg-purple-600"
                  : "w-2 h-2 bg-gray-200"
              }`}
            />
          ))}
        </div>

        <span className="text-sm text-gray-400">
          {step} / {STEPS.length}
        </span>
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        <div className="w-full max-w-md">
          {/* Step label */}
          <p className="text-xs font-semibold uppercase tracking-widest text-purple-500 mb-3">
            Step {step} of {STEPS.length}
          </p>

          {/* Question */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{current.question}</h1>
          <p className="text-gray-500 mb-8">{current.hint}</p>

          {/* Step inputs */}
          {step === 1 && (
            <input
              autoFocus
              type="text"
              placeholder="e.g. Sarah Mensah"
              value={formData.ownerName}
              onChange={(e) => update("ownerName", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full text-xl border-0 border-b-2 border-gray-200 focus:border-purple-500 outline-none pb-3 placeholder-gray-300 transition-colors"
            />
          )}

          {step === 2 && (
            <input
              autoFocus
              type="email"
              placeholder="sarah@mybusiness.com"
              value={formData.email}
              onChange={(e) => update("email", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full text-xl border-0 border-b-2 border-gray-200 focus:border-purple-500 outline-none pb-3 placeholder-gray-300 transition-colors"
            />
          )}

          {step === 3 && (
            <input
              autoFocus
              type="tel"
              placeholder="+233 24 000 0000"
              value={formData.phone}
              onChange={(e) => update("phone", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full text-xl border-0 border-b-2 border-gray-200 focus:border-purple-500 outline-none pb-3 placeholder-gray-300 transition-colors"
            />
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Password</label>
                <div className="relative mt-2">
                  <input
                    autoFocus
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={formData.password}
                    onChange={(e) => update("password", e.target.value)}
                    className="w-full text-xl border-0 border-b-2 border-gray-200 focus:border-purple-500 outline-none pb-3 placeholder-gray-300 pr-10 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Confirm Password</label>
                <div className="relative mt-2">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Same password again"
                    value={formData.confirmPassword}
                    onChange={(e) => update("confirmPassword", e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full text-xl border-0 border-b-2 border-gray-200 focus:border-purple-500 outline-none pb-3 placeholder-gray-300 pr-10 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-0 top-1 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              {/* Inline requirements */}
              <div className="flex flex-wrap gap-3 pt-1">
                {[
                  { label: "8+ chars", ok: formData.password.length >= 8 },
                  { label: "Passwords match", ok: formData.password === formData.confirmPassword && formData.password.length > 0 },
                ].map((r) => (
                  <span
                    key={r.label}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      r.ok ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {r.ok && <Check className="w-3 h-3" />}
                    {r.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="rounded-2xl bg-purple-50 p-5 space-y-3">
                {[
                  { label: "Name", value: formData.ownerName },
                  { label: "Email", value: formData.email },
                  { label: "Phone", value: formData.phone },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="font-medium text-gray-800">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Referral */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Referral Code <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter a referral code"
                  value={formData.affliate}
                  onChange={(e) => update("affliate", e.target.value)}
                  className="w-full mt-2 text-base border-0 border-b-2 border-gray-200 focus:border-purple-500 outline-none pb-3 placeholder-gray-300 transition-colors"
                />
              </div>

              {/* Terms */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(v) => setAcceptTerms(v as boolean)}
                  className="mt-0.5"
                />
                <label htmlFor="terms" className="text-sm text-gray-600 leading-relaxed cursor-pointer">
                  I agree to the{" "}
                  <span className="text-purple-600 font-medium hover:underline cursor-pointer">Terms of Service</span>{" "}
                  and{" "}
                  <span className="text-purple-600 font-medium hover:underline cursor-pointer">Privacy Policy</span>
                </label>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-10">
            {step < 5 ? (
              <button
                onClick={next}
                disabled={!canAdvance()}
                className="flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition-all text-lg"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading || !acceptTerms}
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition-all text-lg"
              >
                {isLoading ? "Creating your account…" : "Create My Account"}
              </button>
            )}
          </div>

          {step === 1 && (
            <p className="mt-6 text-sm text-gray-500">
              Already have an account?{" "}
              <button
                onClick={() => setLocation("/business-login")}
                className="text-purple-600 font-medium hover:underline"
              >
                Sign in here
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Branding footer */}
      <div className="text-center pb-6">
        <p className="text-xs text-gray-300">© 2025 Pointify. All rights reserved.</p>
      </div>
    </div>
  );
}
