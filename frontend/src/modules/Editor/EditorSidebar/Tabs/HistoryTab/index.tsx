"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, XCircle, Search, CalendarIcon, X } from "lucide-react";
import { debounce } from "lodash";
import { useEditorContext } from "@/modules/Context/Editor/Index";
import { useGetQueryHistory } from "@/services/database";
import { timeAgo } from "../../utils";
import type { QueryHistoryItem } from "@/services/bindings/database";
import { getFirstKeyword, highlightSearchMatch } from "./utils";
import { format, endOfDay, startOfDay, differenceInHours } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { DateRange } from "react-day-picker";

const DEBOUNCE_DELAY = 300;

// Format timestamp: show "ago" only within 24 hours when date filter is active
const formatTimestamp = (timestamp: string, hasDateFilter: boolean, timeAgoFn: (ts: string) => string): string => {
    const now = new Date();
    const ts = new Date(timestamp);
    const hoursDiff = differenceInHours(now, ts);

    // If date filter is active and timestamp is more than 24 hours ago, show actual date
    if (hasDateFilter && hoursDiff >= 24) {
        return format(ts, "MMM d, yyyy h:mm a");
    }

    // Otherwise use relative time
    return timeAgoFn(timestamp);
};

export function HistoryTab() {
    const { createTab, updateTab } = useEditorContext();
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    // Create stable debounced setter using lodash.debounce
    const debouncedSetSearch = useMemo(
        () => debounce((value: string) => setDebouncedSearchQuery(value), DEBOUNCE_DELAY),
        []
    );

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            debouncedSetSearch.cancel();
        };
    }, [debouncedSetSearch]);

    // Handle search input change with debounce
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        debouncedSetSearch(value);
    }, [debouncedSetSearch]);

    // Format dates for backend query (ISO format)
    const dateFrom = useMemo(() => {
        if (!dateRange?.from) return "";
        return startOfDay(dateRange.from).toISOString();
    }, [dateRange?.from]);

    const dateTo = useMemo(() => {
        if (!dateRange?.to) return "";
        return endOfDay(dateRange.to).toISOString();
    }, [dateRange?.to]);

    const { data: queryHistory, isFetching } = useGetQueryHistory({
        search: debouncedSearchQuery,
        dateFrom,
        dateTo,
    });

    // Show loading when debounce is pending or data is fetching
    const isPending = searchQuery !== debouncedSearchQuery;
    const isLoading = isPending || isFetching;

    const handleHistoryClick = (sql: string) => {
        const tab = createTab("Query", "query");
        updateTab(tab.id, { sql });
    };

    const clearDateRange = () => {
        setDateRange(undefined);
    };

    const isEmpty = !queryHistory || queryHistory.length === 0;
    const hasFilters = searchQuery.trim() || dateRange?.from;
    const emptyMessage = hasFilters ? "No matching queries found" : "No query history found";

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            {/* Filters */}
            <div className="px-2 py-2 border-b border-border/50 space-y-2">
                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search queries..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="w-full pl-7 pr-2 py-1.5 text-xs bg-sidebar-accent/50 border border-border/50 rounded-md placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring/50"
                    />
                </div>

                {/* Date Range Picker */}
                <div className="flex items-center gap-1">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs flex-1 justify-start text-left font-normal bg-sidebar-accent/50 border-border/50 hover:bg-sidebar-accent"
                            >
                                <CalendarIcon className="mr-1.5 h-3 w-3" />
                                {dateRange?.from ? (
                                    dateRange.to ? (
                                        <span>
                                            {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                                        </span>
                                    ) : (
                                        format(dateRange.from, "MMM d, yyyy")
                                    )
                                ) : (
                                    <span className="text-muted-foreground">Filter by date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={setDateRange}
                                numberOfMonths={2}
                                disabled={(date) => date > new Date()}
                            />
                        </PopoverContent>
                    </Popover>
                    {dateRange?.from && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={clearDateRange}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* History List */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading history...</span>
                        </div>
                    </div>
                ) : isEmpty ? (
                    <div className="px-4 py-2 text-xs text-muted-foreground">
                        {emptyMessage}
                    </div>
                ) : (
                    <div className="flex flex-col px-1">
                        {queryHistory.map((item: QueryHistoryItem) => {
                            const keywordInfo = getFirstKeyword(item.query);
                            return (
                                <button
                                    key={item.id}
                                    className="w-full text-left px-3 py-1.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group transition-colors duration-200 cursor-pointer m-0 rounded-none first:rounded-t-md last:rounded-b-md"
                                    onClick={() => handleHistoryClick(item.query)}
                                >
                                    {/* Header: Status, Time, Count, Duration */}
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-1.5">
                                            {item.status === "success" ? (
                                                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                            ) : (
                                                <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                                            )}
                                            <span className="text-[10px] text-muted-foreground font-medium group-hover:text-sidebar-accent-foreground/70 transition-colors">
                                                {formatTimestamp(item.timestamp, !!dateRange?.from, timeAgo)}
                                            </span>
                                            {item.count > 1 && (
                                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-sidebar-accent text-[9px] font-bold text-sidebar-accent-foreground">
                                                    x{item.count}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground tabular-nums group-hover:text-sidebar-accent-foreground/70 transition-colors">
                                            {item.duration_ms}ms
                                        </span>
                                    </div>

                                    {/* Query Text with Keyword Highlighting */}
                                    <div className="text-xs font-mono text-foreground/90 line-clamp-10 break-all group-hover:text-sidebar-accent-foreground transition-colors">
                                        {keywordInfo ? (
                                            <>
                                                <span className={`${keywordInfo.colorClass} px-1 py-0.5 rounded font-semibold`}>
                                                    {highlightSearchMatch(keywordInfo.keyword, searchQuery)}
                                                </span>
                                                {highlightSearchMatch(keywordInfo.rest, searchQuery)}
                                            </>
                                        ) : (
                                            highlightSearchMatch(item.query, searchQuery)
                                        )}
                                    </div>

                                    {/* Error Message */}
                                    {item.error_message && (
                                        <div className="mt-1 text-[10px] text-red-400 line-clamp-1">
                                            {item.error_message}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
