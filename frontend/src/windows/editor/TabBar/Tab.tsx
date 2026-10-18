import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, FileCode, Table2 } from "lucide-react";
import { useEditorContext } from "@/context/editor/Index";

export const TabBar = () => {
  const { tabs, activeTab, createTab, closeTab, setActiveTab, updateTab } =
    useEditorContext();
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  const handleTabClick = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.button === 0) {
      if (editingTabId !== tabId) {
        setActiveTab(tabId);
      }
    } else if (e.button === 1) {
      handleCloseTab(e, tabId);
    }
    return;
  };

  const handleTabDoubleClick = (tabId: string, currentTitle: string) => {
    setEditingTabId(tabId);
    setEditValue(currentTitle);
  };

  const handleTitleSubmit = (tabId: string) => {
    if (editValue.trim()) {
      updateTab(tabId, { title: editValue.trim() });
    }
    setEditingTabId(null);
    setEditValue("");
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === "Enter") {
      handleTitleSubmit(tabId);
    } else if (e.key === "Escape") {
      setEditingTabId(null);
      setEditValue("");
    }
  };

  // Get icon based on tab mode
  const getTabIcon = (mode: string) => {
    switch (mode) {
      case "query":
        return <FileCode className="h-3.5 w-3.5 shrink-0 text-emerald-500" />;
      case "table":
        return <Table2 className="h-3.5 w-3.5 shrink-0 text-blue-500" />;
      default:
        return (
          <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        );
    }
  };

  return (
    <div className="flex items-center overflow-hidden">
      <div className="flex items-center overflow-x-auto overflow-y-hidden flex-1 scrollbar-thin gap-0.5 px-1 h-full">
        {tabs.map((tab) => {
          const isActive = activeTab?.id === tab.id;
          return (
            <div
              key={tab.id}
              className={`flex items-center group relative min-w-36 max-w-48 select-none rounded-md transition-all duration-200 ${
                isActive
                  ? "bg-background shadow-sm ring-1 ring-border/50"
                  : "bg-transparent hover:bg-background/50"
              }`}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full" />
              )}

              <div
                className="flex items-center gap-2 px-3 py-1 cursor-pointer flex-1 min-w-0"
                onMouseDown={(e) => handleTabClick(e, tab.id)}
                onDoubleClick={() => handleTabDoubleClick(tab.id, tab.title)}
              >
                {getTabIcon(tab.type)}

                {editingTabId === tab.id ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleTitleSubmit(tab.id)}
                    onKeyDown={(e) => handleTitleKeyDown(e, tab.id)}
                    className="bg-transparent text-sm outline-none w-full min-w-0 font-medium"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className={`text-sm truncate flex-1 min-w-0 ${isActive ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {tab.title}
                  </span>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 mr-1.5 hover:bg-destructive/20 cursor-pointer rounded-full transition-opacity"
                onClick={(e) => handleCloseTab(e, tab.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center px-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-3 hover:bg-background cursor-pointer text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors rounded-md select-none"
          onClick={() => createTab()}
          title="New SQL tab"
        >
          + SQL
        </Button>
      </div>
    </div>
  );
};
