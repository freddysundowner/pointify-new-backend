import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2 } from "lucide-react";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (inputValue?: string) => void;
  title: string;
  description: string;
  type: "warning" | "danger" | "input";
  confirmText?: string;
  cancelText?: string;
  inputPlaceholder?: string;
  requiredInput?: string;
}

export default function AlertModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  type,
  confirmText = "Confirm",
  cancelText = "Cancel",
  inputPlaceholder = "",
  requiredInput = "",
}: AlertModalProps) {
  const [inputValue, setInputValue] = useState("");

  const handleConfirm = () => {
    if (type === "input") {
      if (requiredInput && inputValue !== requiredInput) {
        return; // Don't proceed if required input doesn't match
      }
      onConfirm(inputValue);
    } else {
      onConfirm();
    }
    setInputValue("");
    onClose();
  };

  const handleClose = () => {
    setInputValue("");
    onClose();
  };

  const isInputValid = type !== "input" || !requiredInput || inputValue === requiredInput;

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                type === "danger"
                  ? "bg-red-100"
                  : type === "warning"
                  ? "bg-yellow-100"
                  : "bg-blue-100"
              }`}
            >
              {type === "danger" ? (
                <Trash2 className="w-5 h-5 text-red-600" />
              ) : (
                <AlertTriangle
                  className={`w-5 h-5 ${
                    type === "warning" ? "text-yellow-600" : "text-blue-600"
                  }`}
                />
              )}
            </div>
            <AlertDialogTitle
              className={`${
                type === "danger"
                  ? "text-red-800"
                  : type === "warning"
                  ? "text-yellow-800"
                  : "text-blue-800"
              }`}
            >
              {title}
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        
        <AlertDialogDescription className="text-sm text-gray-600 leading-relaxed">
          {description}
        </AlertDialogDescription>

        {type === "input" && (
          <div className="space-y-2 mt-4">
            <Label htmlFor="confirmation-input" className="text-sm font-medium">
              {requiredInput ? `Type "${requiredInput}" to confirm:` : "Input:"}
            </Label>
            <Input
              id="confirmation-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputPlaceholder}
              className={`${
                requiredInput && inputValue && inputValue !== requiredInput
                  ? "border-red-300 focus:border-red-500"
                  : ""
              }`}
            />
            {requiredInput && inputValue && inputValue !== requiredInput && (
              <p className="text-xs text-red-600">
                Please type "{requiredInput}" exactly to confirm
              </p>
            )}
          </div>
        )}

        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel onClick={handleClose} className="mr-2">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isInputValid}
            className={`${
              type === "danger"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : type === "warning"
                ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            } ${!isInputValid ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}