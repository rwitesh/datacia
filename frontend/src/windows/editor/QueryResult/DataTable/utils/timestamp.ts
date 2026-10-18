// Timestamp tooltips for DataTable cells, detected from the raw value (no schema).

import { format, isValid } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

/** Unix seconds range: 2001-09-09 to 2033-05-18 */
const UNIX_SEC_MIN = 1_000_000_000;
const UNIX_SEC_MAX = 2_000_000_000;
/** Unix milliseconds range: 2001-09-09 to 2033-05-18 */
const UNIX_MS_MIN = 1_000_000_000_000;
const UNIX_MS_MAX = 2_000_000_000_000;

const TOOLTIP_FORMAT = "MMM d, yyyy, h:mm:ss a";
const ISO_DATE_PREFIX = /^\s*\d{4}-\d{2}-\d{2}/;

/**
 * Parses a cell value into a Date if it looks like a timestamp.
 * Returns null for non-date strings, numbers outside Unix ranges and other values.
 */
export function parseTimestamp(value: unknown): Date | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    let ms: number;
    if (value >= UNIX_SEC_MIN && value <= UNIX_SEC_MAX) {
      ms = value * 1000;
    } else if (value >= UNIX_MS_MIN && value <= UNIX_MS_MAX) {
      ms = value;
    } else {
      return null;
    }
    const d = new Date(ms);
    return isValid(d) ? d : null;
  }

  // Only date-shaped strings: Date() also accepts text like "1" or "Item 3".
  // WebKit rejects a space between date and time, so it becomes "T".
  if (typeof value === "string" && ISO_DATE_PREFIX.test(value)) {
    const d = new Date(value.trim().replace(" ", "T"));
    return isValid(d) ? d : null;
  }

  return null;
}

/**
 * Formats a Date for tooltip: local (system) and UTC.
 */
export function formatTimestampTooltip(date: Date): { local: string; utc: string } {
  return {
    local: format(date, TOOLTIP_FORMAT),
    utc: `${formatInTimeZone(date, "UTC", TOOLTIP_FORMAT)} UTC`,
  };
}
