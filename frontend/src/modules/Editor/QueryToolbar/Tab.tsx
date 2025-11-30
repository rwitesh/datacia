import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { useEditorContext } from "@/modules/Context/Editor/Index";

export const TabBar = () => {
  const { tabs, activeTab, createTab, closeTab, setActiveTab, updateTab } =
    useEditorContext();
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleCreateTab = () => {
    const newTab = createTab();
    setActiveTab(newTab.id);
  };

  const handleCloseTab = async (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    await closeTab(tabId);
  };

  const handleTabClick = (tabId: string) => {
    if (editingTabId !== tabId) {
      setActiveTab(tabId);
    }
  };

  const handleTabDoubleClick = (tabId: string, currentTitle: string) => {
    setEditingTabId(tabId);
    setEditValue(currentTitle);
  };

  const handleTitleSubmit = (tabId: string) => {
    if (editValue.trim()) {
      updateTab(tabId, { title: editValue.trim() })
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

  return (
    <div className="flex items-center overflow-hidden">
      <div className="flex items-center overflow-x-auto flex-1 scrollbar-thin">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center group relative min-w-32 flex-1 basis-0 border-r select-none ${activeTab?.id === tab.id
              ? "bg-background border-t-2"
              : "bg-muted/50 hover:bg-muted"
              }`}
          >
            <div
              className="flex items-center px-3 py-1 cursor-pointer flex-1 min-w-0"
              onClick={() => handleTabClick(tab.id)}
              onDoubleClick={() => handleTabDoubleClick(tab.id, tab.title)}
            >
              {editingTabId === tab.id ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleTitleSubmit(tab.id)}
                  onKeyDown={(e) => handleTitleKeyDown(e, tab.id)}
                  className="bg-transparent text-sm outline-none w-full min-w-0"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm truncate flex-1 min-w-0">
                  {tab.title}
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 mr-1 hover:bg-destructive/20 cursor-pointer"
              onClick={(e) => handleCloseTab(e, tab.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center px-2 border-l border-border">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-muted cursor-pointer"
          onClick={handleCreateTab}
          title="New tab"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
