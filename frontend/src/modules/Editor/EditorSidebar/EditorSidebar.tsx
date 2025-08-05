import {
  Sidebar,
  SidebarContent,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { useEffect, useState } from "react"
import { RefreshCw, Table } from "lucide-react"
import { FetchTables } from "../../../../wailsjs/go/database/ClickHouse"
import { Button } from "@/components/ui/button"
import { useAppContext } from "@/modules/Context/AppContext"

export function EditorSidebar() {
  const { database, tables, setTables } = useAppContext()
  const [loading, setLoading] = useState(false)

  const loadTables = async () => {
    setLoading(true)
    try {
      const result = await FetchTables()
      setTables(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTables()
  }, [database])
 
  return (
    <Sidebar style={{ position: "sticky" }}>
      <SidebarContent className="flex flex-col h-full gap-0">
        <div className="shrink-0 sticky top-0 bg-sidebar border-b border-sidebar-border z-10 px-3 py-2">
          <div className="flex items-center w-full">
            <Table className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">Tables</span>
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={loadTables}
                disabled={loading}
                className="h-5 w-5 cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="space-y-1 ">
            {tables.map((table) => (
              <div key={table} className="cursor-pointer">
                <SidebarMenuButton className="text-xs h-6 w-full justify-start hover:bg-sidebar-accent cursor-pointer">
                  <Table className="h-3 w-3 mr-2 opacity-60" />
                  <span className="truncate">{table}</span>
                </SidebarMenuButton>
              </div>
            ))}
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  )
}