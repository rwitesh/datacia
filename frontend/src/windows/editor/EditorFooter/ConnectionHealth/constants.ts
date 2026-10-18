// Connection statuses by round-trip time in ms; upperBound is exclusive.
export const RTT_STATUSES = [
  { upperBound: 50, color: "text-green-500", name: "Excellent" },
  { upperBound: 150, color: "text-green-500", name: "Good" },
  { upperBound: 300, color: "text-yellow-500", name: "Fair" },
  { upperBound: 1000, color: "text-orange-500", name: "Degraded" },
  { upperBound: Infinity, color: "text-red-500", name: "Poor" },
];

export const DISCONNECTED_STATUS = { color: "text-red-500", name: "Disconnected" };
