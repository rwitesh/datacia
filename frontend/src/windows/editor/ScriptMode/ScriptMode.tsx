import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Plus, StopCircle } from "lucide-react";
import { ScriptBlock, type ScriptBlockData } from "./ScriptBlock";
import { nanoid } from "nanoid";
import { RunQuery } from "@/services/bindings/database";

export function ScriptMode() {
    const [blocks, setBlocks] = useState<ScriptBlockData[]>([
        { id: nanoid(), sql: "", status: "idle" },
    ]);
    const [isRunning, setIsRunning] = useState(false);

    const shouldStopRef = useRef(false);

    const addBlock = () => {
        setBlocks((prev) => [
            ...prev,
            { id: nanoid(), sql: "", status: "idle" },
        ]);
    };

    const removeBlock = (id: string) => {
        setBlocks((prev) => prev.filter((b) => b.id !== id));
    };

    const updateBlock = (id: string, sql: string) => {
        setBlocks((prev) =>
            prev.map((b) => (b.id === id ? { ...b, sql } : b))
        );
    };

    const updateBlockStatus = (id: string, status: ScriptBlockData["status"], errorMessage?: string, executionTime?: number) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, status, errorMessage, executionTime } : b));
    }

    const executeBlock = async (id: string) => {
        const block = blocks.find(b => b.id === id);
        if (!block) return;

        // If empty sql, just mark success or skip? 
        // Let's mark success to show it was processed.
        if (!block.sql.trim()) {
            updateBlockStatus(id, "success");
            return;
        }

        updateBlockStatus(id, "running");

        const startTime = Date.now();

        try {
            await RunQuery(block.sql);

            updateBlockStatus(id, "success", undefined, Date.now() - startTime);

        } catch (e) {
            updateBlockStatus(id, "error", (e instanceof Error && e.message) || "Unknown error");
            throw e;
        }
    };

    const executeAll = async () => {
        if (isRunning) return;
        setIsRunning(true);
        shouldStopRef.current = false;

        // Reset all statuses?
        setBlocks(prev => prev.map(b => ({ ...b, status: 'idle', errorMessage: undefined, executionTime: undefined })));

        for (const block of blocks) {
            if (shouldStopRef.current) break;

            try {
                await executeBlock(block.id);
            } catch {
                // Error occurred, stop sequence
                break;
            }
        }
        setIsRunning(false);
    };

    const handleStop = () => {
        shouldStopRef.current = true;
    };

    return (
        <div className="flex flex-col h-full bg-background animate-in fade-in duration-300">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 border-b shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        Script Mode
                    </h2>
                    <div className="text-sm text-muted-foreground">
                        Sequential Execution
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isRunning ? (
                        <Button
                            onClick={executeAll}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 cursor-pointer"
                        >
                            <Play className="w-4 h-4" />
                            Execute All
                        </Button>
                    ) : (
                        <Button
                            onClick={handleStop}
                            variant="destructive"
                            className="gap-2 cursor-pointer"
                        >
                            <StopCircle className="w-4 h-4" />
                            Stop
                        </Button>
                    )}
                    <Button onClick={addBlock} variant="outline" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Block
                    </Button>
                </div>
            </div>

            {/* Blocks List */}

            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4 max-w-4xl mx-auto pb-10">
                    {blocks.map((block) => (
                        <ScriptBlock
                            key={block.id}
                            block={block}
                            onUpdate={updateBlock}
                            onRemove={removeBlock}
                            onExecute={() => !isRunning && executeBlock(block.id)}
                            isScriptRunning={isRunning}
                        />
                    ))}

                    <Button
                        variant="outline"
                        className="w-full h-24 border-2 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 text-muted-foreground flex flex-col gap-2 hover:bg-muted/10 transition-colors"
                        onClick={addBlock}
                    >
                        <Plus className="w-6 h-6" />
                        <span>Add New SQL Block</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}
