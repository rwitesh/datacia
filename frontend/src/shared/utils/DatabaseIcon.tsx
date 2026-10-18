import { Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { DATABASE_ENGINES, isValidEngine } from "./engines";

interface DatabaseIconProps {
  engine: string | null | undefined;
  size?: number;
  className?: string;
}

export function DatabaseIcon({ engine, size = 14, className = "shrink-0" }: DatabaseIconProps) {
  if (!isValidEngine(engine)) {
    return <Database className={cn(className, "text-muted-foreground")} style={{ width: size, height: size }} />;
  }

  const { icon, label } = DATABASE_ENGINES[engine];
  return <img src={icon} width={size} height={size} className={className} alt={label} />;
}
