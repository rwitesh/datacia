import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Plus, StopCircle } from "lucide-react";
import { ScriptBlock, type ScriptBlockData } from "./ScriptBlock";
import { v4 as uuidv4 } from "uuid";
import { useCancelQuery, useRunQuery } from "@/services/database";
import { errorMessage } from "@/lib/utils";

export function ScriptMode() {
    const [blocks, setBlocks] = useState<ScriptBlockData[]>([
        { id: uuidv4(), sql: "", status: "idle" },
    ]);
    const [isRunning, setIsRunning] = useState(false);

    const shouldStopRef = useRef(false);
    // The query currently running, so Stop can cancel it.
    const queryIdRef = useRef<string | null>(null);
    const { mutateAsync: runQueryAsync } = useRunQuery();
    const { mutateAsync: cancelQueryAsync } = useCancelQuery();

    const addBlock = () => {
        setBlocks((prev) => [
            ...prev,
            { id: uuidv4(), sql: "", status: "idle" },
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

    // Runs one block and rethrows its error so a sequence can stop.
    const executeBlock = async (block: ScriptBlockData) => {
        // Empty blocks are marked success to show they were processed.
        if (!block.sql.trim()) {
            updateBlockStatus(block.id, "success");
            return;
        }

        updateBlockStatus(block.id, "running");

        const startTime = Date.now();
        const queryId = uuidv4();
        queryIdRef.current = queryId;

        try {
            await runQueryAsync({ sql: block.sql, queryId });
            updateBlockStatus(block.id, "success", undefined, Date.now() - startTime);
        } catch (e) {
            const message = shouldStopRef.current
                ? "Query execution cancelled"
                : errorMessage(e);
            updateBlockStatus(block.id, "error", message);
            throw e;
        } finally {
            queryIdRef.current = null;
        }
    };

    // Runs blocks in order, stopping at the first error or on Stop.
    const runBlocks = async (toRun: ScriptBlockData[]) => {
        if (isRunning) return;
        setIsRunning(true);
        shouldStopRef.current = false;

        for (const block of toRun) {
            if (shouldStopRef.current) break;

            try {
                await executeBlock(block);
            } catch {
                break;
            }
        }
        setIsRunning(false);
    };

    const executeAll = () => {
        setBlocks(prev => prev.map(b => ({ ...b, status: 'idle', errorMessage: undefined, executionTime: undefined })));
        void runBlocks(blocks);
    };

    const executeOne = (id: string) => {
        const block = blocks.find(b => b.id === id);
        if (block) void runBlocks([block]);
    };

    const handleStop = () => {
        shouldStopRef.current = true;
        const queryId = queryIdRef.current;
        if (queryId) {
            cancelQueryAsync(queryId).catch((err) => {
                console.error("Error cancelling script query:", err);
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-background animate-in fade-in duration-300">
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

            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4 max-w-4xl mx-auto pb-10">
                    {blocks.map((block) => (
                        <ScriptBlock
                            key={block.id}
                            block={block}
                            onUpdate={updateBlock}
                            onRemove={removeBlock}
                            onExecute={executeOne}
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
