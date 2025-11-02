import * as React from "react";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  isVisible: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function LoadingOverlay({ 
  isVisible, 
  className,
  children 
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center",
        "bg-background/80 backdrop-blur-sm",
        "animate-in fade-in-0 duration-200",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Spinning loader */}
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-muted"></div>
          <div className="absolute top-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
        
        {/* Loading text */}
        <div className="text-sm text-muted-foreground animate-pulse">
          {children || "Loading..."}
        </div>
      </div>
    </div>
  );
}

export default LoadingOverlay;