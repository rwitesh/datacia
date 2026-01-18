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
} from "@/services/license";
import { CheckCircle2, XCircle, Loader2, Key, Shield, AlertCircle, Calendar, User, Mail, Crown } from "lucide-react";

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

  const isValid = status?.valid ?? false;
  const maskedKey = status?.license_key;
  const expiresAt = status?.expires_at;
  const customerName = status?.customer_name;
  const customerEmail = status?.customer_email;
  const variantName = status?.variant_name;
  const hasLicense = isValid || !!maskedKey; // Show license UI if we have a key or valid status

  useEffect(() => {
    if (!isOpen) {
      setMessage(null);
      setLicenseKey("");
    } else if (status?.error) {
       // If there is a validation error (from backend GetStatus), show it
       setMessage({
         variant: "destructive",
         title: "License Error",
         description: status.error,
       });
    }
  }, [isOpen, status?.error]);

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

  const isLoading =
    isLoadingStatus ||
    activateMutation.isPending ||
    deactivateMutation.isPending;

  const formatExpiryDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return null;
    }
  };

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
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {isValid ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                          )}
                          <div className="font-medium text-sm">
                            {isValid ? "License Active" : "License Invalid"}
                          </div>
                          {variantName && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                              <Crown className="h-3 w-3" />
                              {variantName.charAt(0).toUpperCase() + variantName.slice(1)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1.5">
                          {maskedKey && (
                            <div className="font-mono flex items-center gap-1">
                              <Key className="h-3 w-3" />
                              {maskedKey}
                            </div>
                          )}
                          {expiresAt && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expires: {formatExpiryDate(expiresAt)}
                            </div>
                          )}
                          {(customerName || customerEmail) && (
                            <div className="pt-1 border-t space-y-1">
                              {customerName && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {customerName}
                                </div>
                              )}
                              {customerEmail && (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {customerEmail}
                                </div>
                              )}
                            </div>
                          )}
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
                className="w-full cursor-pointer"
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
            <Button
              onClick={handleDeactivate}
              disabled={isLoading}
              variant="destructive"
              className="w-full cursor-pointer"
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
