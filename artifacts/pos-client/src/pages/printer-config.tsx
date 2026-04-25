import DashboardLayout from "@/components/layout/dashboard-layout";
import { PrinterConfigDialog } from "@/components/printer-config";

export default function PrinterConfigPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Printer Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure your XPrinter thermal printer for receipt printing
          </p>
        </div>
        
        <PrinterConfigDialog />
      </div>
    </DashboardLayout>
  );
}