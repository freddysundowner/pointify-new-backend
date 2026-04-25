import { useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CalculatorState {
  display: string;
  previousValue: number | null;
  operation: string | null;
  waitingForOperand: boolean;
}

export default function CalculatorModal({ isOpen, onClose }: CalculatorModalProps) {
  const [state, setState] = useState<CalculatorState>({
    display: "0",
    previousValue: null,
    operation: null,
    waitingForOperand: false,
  });

  const inputNumber = (num: string) => {
    setState(prev => {
      if (prev.waitingForOperand) {
        return {
          ...prev,
          display: num,
          waitingForOperand: false,
        };
      } else {
        return {
          ...prev,
          display: prev.display === "0" ? num : prev.display + num,
        };
      }
    });
  };

  const inputOperation = (nextOperation: string) => {
    setState(prev => {
      const inputValue = parseFloat(prev.display);

      if (prev.previousValue === null) {
        return {
          ...prev,
          previousValue: inputValue,
          waitingForOperand: true,
          operation: nextOperation,
        };
      } else if (prev.operation) {
        const currentValue = prev.previousValue || 0;
        const newValue = calculate(currentValue, inputValue, prev.operation);

        return {
          ...prev,
          display: String(newValue),
          previousValue: newValue,
          waitingForOperand: true,
          operation: nextOperation,
        };
      }

      return {
        ...prev,
        waitingForOperand: true,
        operation: nextOperation,
      };
    });
  };

  const calculate = (firstValue: number, secondValue: number, operation: string): number => {
    switch (operation) {
      case "+": return firstValue + secondValue;
      case "-": return firstValue - secondValue;
      case "*": return firstValue * secondValue;
      case "/": return firstValue / secondValue;
      case "=": return secondValue;
      default: return secondValue;
    }
  };

  const performCalculation = () => {
    setState(prev => {
      const inputValue = parseFloat(prev.display);

      if (prev.previousValue !== null && prev.operation) {
        const newValue = calculate(prev.previousValue, inputValue, prev.operation);
        return {
          display: String(newValue),
          previousValue: null,
          operation: null,
          waitingForOperand: true,
        };
      }

      return prev;
    });
  };

  const clear = () => {
    setState({
      display: "0",
      previousValue: null,
      operation: null,
      waitingForOperand: false,
    });
  };

  const backspace = () => {
    setState(prev => ({
      ...prev,
      display: prev.display.length > 1 ? prev.display.slice(0, -1) : "0",
    }));
  };

  const inputDecimal = () => {
    setState(prev => {
      if (prev.waitingForOperand) {
        return {
          ...prev,
          display: "0.",
          waitingForOperand: false,
        };
      } else if (prev.display.indexOf(".") === -1) {
        return {
          ...prev,
          display: prev.display + ".",
        };
      }
      return prev;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-white/95 backdrop-blur-md border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-xl font-bold">
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Calculator
            </span>
            <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full hover:bg-gray-100">
              <X className="h-5 w-5" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Calculator Display */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-2xl shadow-inner">
            <div className="text-right text-3xl font-mono text-white font-bold">
              {state.display}
            </div>
          </div>
          
          {/* Calculator Buttons */}
          <div className="grid grid-cols-4 gap-3">
            {/* Row 1 */}
            <Button
              variant="secondary"
              onClick={clear}
              className="h-14 font-bold text-lg rounded-2xl bg-red-100 hover:bg-red-200 text-red-700 border-0"
            >
              C
            </Button>
            <Button
              variant="secondary"
              onClick={() => inputOperation("/")}
              className="h-14 font-bold text-lg rounded-2xl bg-orange-100 hover:bg-orange-200 text-orange-700 border-0"
            >
              ÷
            </Button>
            <Button
              variant="secondary"
              onClick={() => inputOperation("*")}
              className="h-14 font-bold text-lg rounded-2xl bg-orange-100 hover:bg-orange-200 text-orange-700 border-0"
            >
              ×
            </Button>
            <Button
              variant="secondary"
              onClick={backspace}
              className="h-14 font-bold text-lg rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-700 border-0"
            >
              ⌫
            </Button>

            {/* Row 2 */}
            <Button
              variant="outline"
              onClick={() => inputNumber("7")}
              className="h-14 font-bold text-lg rounded-2xl bg-white hover:bg-gray-50 border-gray-200"
            >
              7
            </Button>
            <Button
              variant="outline"
              onClick={() => inputNumber("8")}
              className="h-14 font-bold text-lg rounded-2xl bg-white hover:bg-gray-50 border-gray-200"
            >
              8
            </Button>
            <Button
              variant="outline"
              onClick={() => inputNumber("9")}
              className="h-14 font-bold text-lg rounded-2xl bg-white hover:bg-gray-50 border-gray-200"
            >
              9
            </Button>
            <Button
              variant="secondary"
              onClick={() => inputOperation("-")}
              className="h-14 font-bold text-lg rounded-2xl bg-orange-100 hover:bg-orange-200 text-orange-700 border-0"
            >
              -
            </Button>

            {/* Row 3 */}
            <Button
              variant="outline"
              onClick={() => inputNumber("4")}
              className="h-14 font-bold text-lg rounded-2xl bg-white hover:bg-gray-50 border-gray-200"
            >
              4
            </Button>
            <Button
              variant="outline"
              onClick={() => inputNumber("5")}
              className="h-14 font-bold text-lg rounded-2xl bg-white hover:bg-gray-50 border-gray-200"
            >
              5
            </Button>
            <Button
              variant="outline"
              onClick={() => inputNumber("6")}
              className="h-14 font-bold text-lg rounded-2xl bg-white hover:bg-gray-50 border-gray-200"
            >
              6
            </Button>
            <Button
              variant="secondary"
              onClick={() => inputOperation("+")}
              className="h-14 font-bold text-lg rounded-2xl bg-orange-100 hover:bg-orange-200 text-orange-700 border-0"
            >
              +
            </Button>

            {/* Row 4 & 5 */}
            <Button
              variant="outline"
              onClick={() => inputNumber("1")}
              className="h-14 font-bold text-lg rounded-2xl bg-white hover:bg-gray-50 border-gray-200"
            >
              1
            </Button>
            <Button
              variant="outline"
              onClick={() => inputNumber("2")}
              className="h-14 font-bold text-lg rounded-2xl bg-white hover:bg-gray-50 border-gray-200"
            >
              2
            </Button>
            <Button
              variant="outline"
              onClick={() => inputNumber("3")}
              className="h-14 font-bold text-lg rounded-2xl bg-white hover:bg-gray-50 border-gray-200"
            >
              3
            </Button>
            <Button
              className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-bold text-lg row-span-2 rounded-2xl shadow-lg"
              onClick={performCalculation}
            >
              =
            </Button>

            <Button
              variant="outline"
              onClick={() => inputNumber("0")}
              className="col-span-2 h-14 font-bold text-lg rounded-2xl bg-white hover:bg-gray-50 border-gray-200"
            >
              0
            </Button>
            <Button
              variant="outline"
              onClick={inputDecimal}
              className="h-14 font-bold text-lg rounded-2xl bg-white hover:bg-gray-50 border-gray-200"
            >
              .
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
