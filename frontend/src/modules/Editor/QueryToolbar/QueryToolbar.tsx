import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export function QueryToolbar({ runQuery}: {
    runQuery: () => void;
}) {

    return (
        <div className="flex items-center justify-end p-2 bg-muted/50">
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="p-1 cursor-pointer"
                    onClick={runQuery}
                >
                    <Play color="limegreen" strokeWidth={2}/> Run
                </Button>
            </div>
        </div>
    )
}