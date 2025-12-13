export function downloadJSON(data: object, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function downloadCSV(data: Record<string, unknown>, filename: string) {
    // For single row export
    const headers = Object.keys(data).join(",");
    const values = Object.values(data)
        .map(value => {
            if (value === null || value === undefined) return "";
            const str = String(value);
            // Escape quotes and wrap in quotes if contains comma or quote
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        })
        .join(",");

    const csvContent = `${headers}\n${values}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
