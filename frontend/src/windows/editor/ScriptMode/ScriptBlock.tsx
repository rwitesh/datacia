import { Button } from "@/components/ui/button";
import { SQLCodeEditor } from "../QueryInput/SQLCodeEditor";
import { Play, Loader2, CircleCheck, CircleX, X } from "lucide-react";

export interface ScriptBlockData {
    id: string;
    sql: string;
    status: "idle" | "running" | "success" | "error";
    errorMessage?: string;
    executionTime?: number; // ms
}

interface ScriptBlockProps {
    block: ScriptBlockData;
    onUpdate: (id: string, sql: string) => void;
    onRemove: (id: string) => void;
    onExecute: (id: string) => void;
    isScriptRunning: boolean;
}

export function ScriptBlock({
    block,
    onUpdate,
    onRemove,
    onExecute,
    isScriptRunning,
}: ScriptBlockProps) {
    return (
        <div className="flex flex-col border rounded-md overflow-hidden bg-card transition-all">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground uppercase opacity-70">
                        Block {block.id.slice(0, 4)}
                    </span>
                    {block.status === "running" && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-500 font-medium animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Running...
                        </div>
                    )}
                    {block.status === "success" && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                            <CircleCheck className="w-3.5 h-3.5" />
                            Success {block.executionTime ? `(${block.executionTime}ms)` : ""}
                        </div>
                    )}
                    {block.status === "error" && (
                        <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                            <CircleX className="w-3.5 h-3.5" />
                            Error
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {!isScriptRunning && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => onExecute(block.id)}
                            title="Execute this block"
                        >
                            <Play className="w-3.5 h-3.5" />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove(block.id)}
                        disabled={isScriptRunning}
                        title="Remove block"
                    >
                        <X className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            <div className="border-b relative overflow-hidden resize-y min-h-[100px]">
                <SQLCodeEditor
                    value={block.sql}
                    onChange={(val) => onUpdate(block.id, val)}
                    className="h-full"
                />
            </div>

            {block.status === "error" && block.errorMessage && (
                <div className="bg-red-500/10 text-red-500 text-xs font-mono p-2 border-t border-red-500/20 whitespace-pre-wrap">
                    {block.errorMessage}
                </div>
            )}
        </div>
    );
}
