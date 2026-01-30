/**
 * Connection health status definitions based on RTT (Round Trip Time)
 * Simple constants - easy to update, add, or remove
 */

export type ConnectionStatus = 
  | "excellent"
  | "good"
  | "fair"
  | "degraded"
  | "poor"
  | "disconnected"
  | "unknown";

/**
 * RTT status ranges - upper bound (exclusive) and color
 */
export const RTT_RANGES = [
  { upperBound: 50, color: "text-green-500", name: "Excellent" },
  { upperBound: 150, color: "text-green-500", name: "Good" },
  { upperBound: 300, color: "text-yellow-500", name: "Fair" },
  { upperBound: 1000, color: "text-orange-500", name: "Degraded" },
  { upperBound: Infinity, color: "text-red-500", name: "Poor" },
] as const;

/**
 * Status colors
 */
export const STATUS_COLORS: Record<ConnectionStatus, string> = {
  excellent: "text-green-500",
  good: "text-green-500",
  fair: "text-yellow-500",
  degraded: "text-orange-500",
  poor: "text-red-500",
  disconnected: "text-red-500",
  unknown: "text-foreground",
};

/**
 * Status names
 */
export const STATUS_NAMES: Record<ConnectionStatus, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  degraded: "Degraded",
  poor: "Poor",
  disconnected: "Disconnected",
  unknown: "Unknown",
};
