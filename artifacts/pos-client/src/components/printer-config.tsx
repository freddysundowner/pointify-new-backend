import { useState, useEffect } from "react";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Printer, Settings, Wifi, TestTube, CheckCircle, XCircle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PrinterConfig {
  type: 'TCP' | 'USB' | 'SERIAL' | 'SYSTEM';
  interface: string;
  width?: number;
  characterSet?: string;
}

interface PrinterStatus {
  initialized: boolean;
  config: PrinterConfig | null;
}

export function PrinterConfigDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<PrinterConfig>({
    type: 'TCP',
    interface: '',
    width: 32,
    characterSet: 'PC437_USA'
  });
  const [status, setStatus] = useState<PrinterStatus>({ initialized: false, config: null });
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadPrinterStatus();
  }, []);

  useEffect(() => {
    if (isOpen && config.type === 'SYSTEM') {
      fetch(ENDPOINTS.printer.list)
        .then(res => res.json())
        .then(data => setAvailablePrinters(data.printers || []))
        .catch(err => console.error('Failed to load printers', err));
    }
  }, [isOpen, config.type]);

  const loadPrinterStatus = async () => {
    try {
      const response = await fetch(ENDPOINTS.printer.status);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      setStatus(data);
      if (data.config) setConfig(data.config);
    } catch (err) {
      console.error('Failed to load printer status:', err);
      setStatus({ initialized: false, config: null });
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(ENDPOINTS.printer.initialize, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Printer Configured", description: "Printer has been configured successfully" });
        await loadPrinterStatus();
        setIsOpen(false);
      } else {
        throw new Error(data.message || 'Configuration failed');
      }
    } catch (err) {
      toast({
        title: "Configuration Failed",
        description: err instanceof Error ? err.message : "Failed to configure printer",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    if (!status.initialized) {
      toast({
        title: "Printer Not Configured",
        description: "Please configure the printer first",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(ENDPOINTS.printer.test, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Test Successful", description: "Test print completed successfully" });
      } else {
        throw new Error(data.message || 'Test failed');
      }
    } catch (err) {
      toast({
        title: "Test Failed",
        description: err instanceof Error ? err.message : "Test print failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Printer Status Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center space-x-2">
            <Printer className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">Printer Status</CardTitle>
          </div>
          {status.initialized ? (
            <Badge variant="success" className="flex items-center space-x-1">
              <CheckCircle className="h-3 w-3" />
              <span>Connected</span>
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <XCircle className="h-3 w-3" />
              <span>Not Configured</span>
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              {status.config && (
                <div className="text-sm text-muted-foreground">
                  {status.config.type}: {status.config.interface}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                {status.initialized ? 'Ready for printing' : 'Configure printer to start printing'}
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={!status.initialized || isLoading}
              >
                <TestTube className="h-3 w-3 mr-1" />
                Test
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
                <Settings className="h-3 w-3 mr-1" />
                Configure
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isOpen && (
        <Card className="w-full max-w-2xl mx-auto mt-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Printer className="h-5 w-5" />
              <span>Printer Configuration</span>
            </CardTitle>
            <CardDescription>Configure your receipt printer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Connection Type</Label>
              <Select
                value={config.type}
                onValueChange={(value: any) => setConfig({ ...config, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select connection type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TCP">Network (TCP/IP)</SelectItem>
                  <SelectItem value="USB">USB Connection</SelectItem>
                  <SelectItem value="SERIAL">Serial Port</SelectItem>
                  <SelectItem value="SYSTEM">System Printer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {config.type === 'TCP' && 'IP Address'}
                {config.type === 'USB' && 'USB Device Path'}
                {config.type === 'SERIAL' && 'Serial Port'}
                {config.type === 'SYSTEM' && 'Printer Name'}
              </Label>
              <Input
                value={config.interface}
                onChange={(e) => setConfig({ ...config, interface: e.target.value })}
                placeholder={
                  config.type === 'TCP' ? '192.168.1.100' :
                  config.type === 'USB' ? '/dev/usb/lp0' :
                  config.type === 'SERIAL' ? 'COM3' :
                  'Select a printer or type'
                }
              />
            </div>

            {/* Auto discovered printers */}
            {config.type === 'SYSTEM' && availablePrinters.length > 0 && (
              <div className="space-y-2">
                <Label>Available Printers</Label>
                <div className="space-y-1">
                  {availablePrinters.map(printer => (
                    <div
                      key={printer}
                      className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-muted"
                      onClick={() => setConfig({ ...config, interface: printer })}
                    >
                      <div className="flex items-center space-x-2">
                        <Printer className="h-4 w-4" />
                        <span>{printer}</span>
                      </div>
                      <Button variant="ghost" size="sm">Select</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={!status.initialized || isLoading}
                >
                  <TestTube className="h-4 w-4 mr-1" />
                  Test Print
                </Button>
                <Button onClick={handleSave} disabled={isLoading}>
                  {isLoading ? 'Configuring...' : 'Save Configuration'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
