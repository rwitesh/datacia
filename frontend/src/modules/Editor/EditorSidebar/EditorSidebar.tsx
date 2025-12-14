import { AppWindowIcon, History, FolderTree } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useGetQueryHistory } from "@/services/hooks";
import { QueriesTab } from "./Tabs/QueriesTab";
import { TablesTab } from "./Tabs/TablesTab";
import { HistoryTab } from "./Tabs/HistoryTab";

export function EditorSidebar() {
  const { refetch: refetchHistory } = useGetQueryHistory();

  return (
    <div className="h-full min-h-0 w-full flex flex-col select-none cursor-default pt-12 bg-sidebar">
      <Tabs defaultValue="tables" className="flex flex-1 min-h-0 flex-col">
        <div className="sticky top-0 z-10 border-b border-sidebar-border bg-sidebar px-2 py-1">
          <TabsList className="grid w-full grid-cols-3 bg-transparent p-0">
            <TabsTrigger
              value="tables"
              className="flex items-center gap-2 px-2 py-1.5 text-xs data-[state=active]:bg-sidebar-accent"
            >
              <AppWindowIcon className="h-4 w-4" />
              <span>Tables</span>
            </TabsTrigger>
            <TabsTrigger
              value="queries"
              className="flex items-center gap-2 px-2 py-1.5 text-xs data-[state=active]:bg-sidebar-accent"
            >
              <FolderTree className="h-4 w-4" />
              <span>Queries</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex items-center gap-2 px-2 py-1.5 text-xs data-[state=active]:bg-sidebar-accent"
              onClick={() => refetchHistory()}
            >
              <History className="h-4 w-4" />
              <span>History</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="tables"
          className="flex flex-1 min-h-0 flex-col pl-2 focus-visible:outline-none focus-visible:ring-0"
        >
          <TablesTab />
        </TabsContent>

        <TabsContent
          value="queries"
          className="flex flex-1 min-h-0 flex-col focus-visible:outline-none focus-visible:ring-0"
        >
          <QueriesTab />
        </TabsContent>

        <TabsContent
          value="history"
          className="flex flex-1 min-h-0 flex-col px-0 py-0 focus-visible:outline-none focus-visible:ring-0"
        >
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
