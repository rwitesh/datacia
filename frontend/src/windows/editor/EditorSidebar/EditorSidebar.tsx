import { AppWindowIcon, History, FolderTree } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueriesTab } from "./Tabs/QueriesTab";
import { TablesTab } from "./Tabs/TablesTab";
import { HistoryTab } from "./Tabs/HistoryTab";

export function EditorSidebar() {
  return (
    <div className="h-full min-h-0 w-full flex flex-col select-none cursor-default ">
      <Tabs defaultValue="tables" className="flex flex-1 min-h-0 flex-col">
        <div className="sticky top-0 z-10 px-2 py-1">
          <TabsList className="grid w-full grid-cols-3 p-0 gap-1 bg-transparent">
            <TabsTrigger
              value="tables"
              className="flex items-center justify-center gap-1 px-1.5 py-1 min-w-0 rounded-md transition-colors"
            >
              <AppWindowIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-xs">Tables</span>
            </TabsTrigger>
            <TabsTrigger
              value="queries"
              className="flex items-center justify-center gap-1 px-1.5 py-1 min-w-0 rounded-md transition-colors"
            >
              <FolderTree className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-xs">Queries</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex items-center justify-center gap-1 px-1.5 py-1 min-w-0 rounded-md transition-colors"
            >
              <History className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-xs">History</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="tables"
          className="flex flex-1 min-h-0 flex-col pl-2 mt-0 focus-visible:outline-none focus-visible:ring-0"
        >
          <TablesTab />
        </TabsContent>

        <TabsContent
          value="queries"
          className="flex flex-1 min-h-0 flex-col mt-0 focus-visible:outline-none focus-visible:ring-0"
        >
          <QueriesTab />
        </TabsContent>

        <TabsContent
          value="history"
          className="flex flex-1 min-h-0 flex-col px-0 py-0 mt-0 focus-visible:outline-none focus-visible:ring-0"
        >
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
