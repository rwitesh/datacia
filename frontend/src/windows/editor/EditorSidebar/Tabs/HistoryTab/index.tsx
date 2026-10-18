import { useState, useMemo } from "react";
import { Loader2, CheckCircle2, XCircle, Search, CalendarIcon, X } from "lucide-react";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useEditorContext } from "@/context/editor/Index";
import { setTabSql } from "@/context/editor/store";
import { useGetQueryHistory } from "@/services/database";
import { startOfDay, endOfDay, differenceInHours } from "date-fns";
import {
  timeAgo,
  formatDateTime,
  formatDateShort,
  formatDateLong
} from "@/windows/editor/EditorSidebar/utils";
import type { QueryHistoryItem } from "@/services/bindings/database";
import { getFirstKeyword, highlightSearchMatch } from "./utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { DateRange } from "react-day-picker";

const DEBOUNCE_DELAY = 300;

/**
 * Format timestamp for display: relative time ("2 hours ago"), or the full
 * date when a date filter is active and the entry is 24 hours old or more.
 */
function formatTimestamp(timestamp: string, hasDateFilter: boolean): string {
  const now = new Date();
  const ts = new Date(timestamp);
  const hoursDiff = differenceInHours(now, ts);

  // If date filter is active and timestamp is more than 24 hours ago, show actual date
  if (hasDateFilter && hoursDiff >= 24) {
    return formatDateTime(ts);
  }

  return timeAgo(timestamp);
}

export function HistoryTab() {
  const { createTab } = useEditorContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, DEBOUNCE_DELAY);
  const debouncedDateRange = useDebouncedValue(dateRange, DEBOUNCE_DELAY);

  // Build filter params for SQLite query
  const filters = useMemo(() => {
    const dateFrom = debouncedDateRange?.from
      ? startOfDay(debouncedDateRange.from).toISOString()
      : "";
    const dateTo = debouncedDateRange?.to
      ? endOfDay(debouncedDateRange.to).toISOString()
      : debouncedDateRange?.from
        ? endOfDay(debouncedDateRange.from).toISOString()
        : "";
    return {
      search: debouncedSearchQuery,
      dateFrom,
      dateTo
    };
  }, [debouncedSearchQuery, debouncedDateRange]);

  // Fetch history with filters applied on SQLite (server-side filtering)
  const { data: historyData, isFetching } = useGetQueryHistory(filters);

  // Show loading when debounce is pending or data is fetching
  const isSearchPending = searchQuery !== debouncedSearchQuery;
  const isDatePending = dateRange !== debouncedDateRange;
  const isLoading = isSearchPending || isDatePending || isFetching;

  const handleHistoryClick = (sql: string) => {
    const tab = createTab("Query", "query");
    setTabSql(tab.id, sql);
  };

  const clearDateRange = () => {
    setDateRange(undefined);
  };

  const isEmpty = !historyData || historyData.length === 0;
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
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 bg-sidebar-accent/50 border border-border/50 rounded-md placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring/50"
          />
        </div>

        {/* Date Range Picker */}
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 flex-1 justify-start text-left font-normal bg-sidebar-accent/50 border-border/50 hover:bg-sidebar-accent"
              >
                <CalendarIcon className="mr-1.5 h-3 w-3" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <span>
                      {formatDateShort(dateRange.from)} - {formatDateShort(dateRange.to)}
                    </span>
                  ) : (
                    formatDateLong(dateRange.from)
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
                disabled={(date) => {
                  const now = new Date();
                  if (date > now) return true;
                  const oneYearAgo = new Date(now);
                  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                  return startOfDay(date) < startOfDay(oneYearAgo);
                }}
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
            {historyData?.map((item: QueryHistoryItem) => {
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
                        {formatTimestamp(item.timestamp, !!dateRange?.from)}
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
                  <div className="font-mono text-foreground/90 line-clamp-10 break-all group-hover:text-sidebar-accent-foreground transition-colors">
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
