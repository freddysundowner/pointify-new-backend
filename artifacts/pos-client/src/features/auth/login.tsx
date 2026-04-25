import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { User, UserCheck, MapPin } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    if (role === "business-owner") {
      setLocation("/business-login");
    } else if (role === "attendant") {
      setLocation("/attendant/login");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and Brand */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mr-3">
              <div className="w-6 h-6 bg-white rounded-full"></div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              <span className="text-purple-600">P</span>ointify
            </h1>
          </div>
          <p className="text-gray-600 text-sm">An enterprise at your hand.</p>
        </div>

        {/* Role Selection */}
        <div className="space-y-4">
          {/* Business Owner Button */}
          <Button
            onClick={() => handleRoleSelect("business-owner")}
            variant="outline"
            className="w-full h-14 text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300 transition-all duration-200"
          >
            <User className="w-5 h-5 mr-3" />
            <span className="font-medium">BUSINESS OWNER</span>
          </Button>

          {/* Attendant Button */}
          <Button
            onClick={() => handleRoleSelect("attendant")}
            className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all duration-200"
          >
            <UserCheck className="w-5 h-5 mr-3" />
            <span>ATTENDANT</span>
          </Button>

          {/* Divider */}
          <div className="text-center py-2">
            <span className="text-gray-400 text-sm">or</span>
          </div>

          {/* Shops Around You */}
          <Button
            variant="ghost"
            className="w-full text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-all duration-200"
          >
            <MapPin className="w-4 h-4 mr-2" />
            <span className="text-sm">Shops Around You</span>
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs text-gray-400">
            © 2025 Pointify. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}