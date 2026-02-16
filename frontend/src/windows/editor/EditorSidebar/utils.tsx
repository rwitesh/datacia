import {
  startOfDay as startOfDayFns,
  endOfDay as endOfDayFns,
  differenceInHours as differenceInHoursFns,
  format as formatFns,
  formatDistanceToNow,
} from "date-fns";

export const startOfDay = startOfDayFns;
export const endOfDay = endOfDayFns;
export const differenceInHours = differenceInHoursFns;

export function formatDateShort(d: Date): string {
  return formatFns(d, "MMM d");
}

export function formatDateLong(d: Date): string {
  return formatFns(d, "MMM d, yyyy");
}

export function formatDateTime(d: Date): string {
  return formatFns(d, "MMM d, yyyy, h:mm a");
}

export function timeAgo(timestamp: string): string {
  const now = new Date();
  const ts = new Date(timestamp);
  if (ts.getTime() > now.getTime()) return "in the future";
  return formatDistanceToNow(ts, { addSuffix: true });
}
