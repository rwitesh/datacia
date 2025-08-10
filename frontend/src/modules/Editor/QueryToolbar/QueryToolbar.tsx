import { Button } from "@/components/ui/button";
import { Play, StopCircle } from "lucide-react";

export function QueryToolbar({ isExecuting, runQuery, stopQuery }: {
    isExecuting: boolean;
    runQuery: () => void;
    stopQuery: () => void;
}) {
    return (
        <div className="flex items-center justify-end p-2 bg-muted/50">
            <div className="flex items-center gap-2">
                {
                    !isExecuting ? <Button
                        variant="outline"
                        size="sm"
                        className="p-1 cursor-pointer"
                        onClick={runQuery}
                    >
                        <Play color="limegreen" strokeWidth={2} /> Run
                    </Button> : <Button
                        variant="outline"
                        size="sm"
                        className="p-1 cursor-pointer"
                        onClick={stopQuery}
                    >
                        <StopCircle color="limegreen" strokeWidth={2} /> Stop
                    </Button>
                }
            </div>
        </div>
    )
}