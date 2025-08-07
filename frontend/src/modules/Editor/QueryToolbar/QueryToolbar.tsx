import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {MenuBar } from "./Menubar";

export function QueryToolbar({ runQuery, sqlQuery, setSqlQuery, isExecuting }: {
    runQuery: () => void;
    sqlQuery: string;
    setSqlQuery: (value: string) => void;
    isExecuting: boolean;
}) {

    return (
        <div className="flex items-center justify-between p-2 bg-muted/50">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="cursor-pointer" />
                <MenuBar />
            </div>
            <div className="flex items-center gap-2">

                <Button
                    variant="outline"
                    size="sm"
                    onClick={runQuery}
                    disabled={isExecuting || !sqlQuery.trim()}
                    className="cursor-pointer"
                >
                    {isExecuting ? "Executing..." : "Execute"}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSqlQuery("")}
                    disabled={isExecuting || !sqlQuery.trim()}
                    className="cursor-pointer"
                >
                    Clear
                </Button>
            </div>
        </div>
    )
}