export function startOfDay(d: Date): Date {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
}

export function endOfDay(d: Date): Date {
    const out = new Date(d);
    out.setHours(23, 59, 59, 999);
    return out;
}

export function differenceInHours(a: Date, b: Date): number {
    return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60));
}

export function formatDateShort(d: Date): string {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateLong(d: Date): string {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(d: Date): string {
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${date} ${time}`;
}

export const timeAgo = (timestamp: string) => {
    const now = new Date();
    const ts = new Date(timestamp);
    const diffMS = now.getTime() - ts.getTime();
    if (diffMS < 0) return "in the future";

    const sec = Math.floor(diffMS / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    const month = Math.floor(day / 30);
    const year = Math.floor(month / 12);

    const format = (value: number, unit: string) =>
        value === 1 ? `1 ${unit}` : `${value} ${unit}s`;

    if (year > 0) {
        const m = month % 12;
        return m > 0
            ? `${format(year, "year")} ${format(m, "month")} ago`
            : `${format(year, "year")} ago`;
    }

    if (month > 0) {
        const d = day % 30;
        return d > 0
            ? `${format(month, "month")} ${format(d, "day")} ago`
            : `${format(month, "month")} ago`;
    }

    if (day > 0) {
        const h = hr % 24;
        return h > 0
            ? `${format(day, "day")} ${format(h, "hour")} ago`
            : `${format(day, "day")} ago`;
    }

    if (hr > 0) {
        const m = min % 60;
        return m > 0
            ? `${format(hr, "hour")} ${format(m, "minute")} ago`
            : `${format(hr, "hour")} ago`;
    }

    if (min > 0) {
        const s = sec % 60;
        return s > 0
            ? `${format(min, "minute")} ${format(s, "second")} ago`
            : `${format(min, "minute")} ago`;
    }

    return sec <= 1 ? "just now" : `${format(sec, "second")} ago`;
};
