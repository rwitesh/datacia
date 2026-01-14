import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  useLicenseStatus,
  useActivateLicense,
  useDeactivateLicense,
  useValidateLicense,
} from "@/services/hooks";
import { CheckCircle2, XCircle, Loader2, Key, Shield } from "lucide-react";

interface LicenseDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LicenseDialog({
  children,
  open: controlledOpen,
  onOpenChange,
}: LicenseDialogProps) {
  const [licenseKey, setLicenseKey] = useState("");
  const [internalOpen, setInternalOpen] = useState(false);
  const [message, setMessage] = useState<{
    variant: "destructive" | "success";
    title: string;
    description?: string;
  } | null>(null);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const { data: status, isLoading: isLoadingStatus } = useLicenseStatus();
  const activateMutation = useActivateLicense();
  const deactivateMutation = useDeactivateLicense();
  const validateMutation = useValidateLicense();

  const hasLicense = status?.has_license ?? false;
  const machineMatch = status?.machine_match ?? false;

  useEffect(() => {
    if (!isOpen) {
      setMessage(null);
      setLicenseKey("");
    }
  }, [isOpen]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!licenseKey.trim()) {
      setMessage({
        variant: "destructive",
        title: "License key required",
        description: "Please enter your license key and try again.",
      });
      return;
    }

    try {
      const result = await activateMutation.mutateAsync(licenseKey);
      if (result.success) {
        setMessage({
          variant: "success",
          title: "Activated",
          description: result.message || "License activated successfully.",
        });
      } else {
        setMessage({
          variant: "destructive",
          title: "Activation failed",
          description: result.error || result.message || "Failed to activate license.",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to activate license";
      setMessage({
        variant: "destructive",
        title: "Activation failed",
        description: message,
      });
    }
  };

  const handleDeactivate = async () => {
    setMessage(null);
    try {
      const result = await deactivateMutation.mutateAsync();
      if (result.success) {
        setMessage({
          variant: "success",
          title: "Deactivated",
          description: result.message || "License deactivated successfully.",
        });
      } else {
        setMessage({
          variant: "destructive",
          title: "Deactivation failed",
          description: result.error || result.message || "Failed to deactivate license.",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to deactivate license";
      setMessage({
        variant: "destructive",
        title: "Deactivation failed",
        description: message,
      });
    }
  };

  const handleValidate = async () => {
    setMessage(null);
    try {
      const result = await validateMutation.mutateAsync();
      if (result.valid) {
        setMessage({
          variant: "success",
          title: "License valid",
          description: result.message || "Your license is valid.",
        });
      } else {
        setMessage({
          variant: "destructive",
          title: "License invalid",
          description: result.error || result.message || "License validation failed.",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to validate license";
      setMessage({
        variant: "destructive",
        title: "Validation failed",
        description: message,
      });
    }
  };

  const isLoading =
    isLoadingStatus ||
    activateMutation.isPending ||
    deactivateMutation.isPending ||
    validateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px]" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            License Management
          </DialogTitle>
          <DialogDescription>
            Activate, deactivate, or check the status of your license.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {message && (
            <Alert variant={message.variant}>
              <AlertTitle>{message.title}</AlertTitle>
              {message.description && (
                <AlertDescription>{message.description}</AlertDescription>
              )}
            </Alert>
          )}

          {/* License Status */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Current Status</Label>
            {isLoadingStatus ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading status...
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-md border p-3">
                  {hasLicense ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">License Active</div>
                        <div className="text-xs text-muted-foreground">
                          <span>
                            {machineMatch ? "Machine ID matches" : "Machine ID mismatch"}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">No License</div>
                        <div className="text-xs text-muted-foreground">
                          Activate a license to continue
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Activate License Form */}
          {!hasLicense && (
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="license-key" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  License Key
                </Label>
                <Input
                  id="license-key"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="Enter your license key"
                  disabled={isLoading}
                  className="font-mono text-sm"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading || !licenseKey.trim()}
                className="w-full"
              >
                {activateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Activating...
                  </>
                ) : (
                  "Activate License"
                )}
              </Button>
            </form>
          )}

          {/* License Actions */}
          {hasLicense && (
            <div className="space-y-2">
              <Button
                onClick={handleValidate}
                disabled={isLoading}
                variant="outline"
                className="w-full"
              >
                {validateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Validate License"
                )}
              </Button>
              <Button
                onClick={handleDeactivate}
                disabled={isLoading}
                variant="destructive"
                className="w-full"
              >
                {deactivateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deactivating...
                  </>
                ) : (
                  "Deactivate License"
                )}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
