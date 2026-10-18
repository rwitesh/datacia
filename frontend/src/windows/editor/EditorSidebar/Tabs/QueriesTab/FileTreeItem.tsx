import { useState } from "react";
import {
    Trash2,
    Edit2,
    FilePlus,
    FolderPlus,
} from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSeparator
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { useRenameNode, useDeleteNode, useWriteFile } from "@/services/queries";
import type { FileNode } from "@/services/bindings";
import { CreationInput } from "../utils/CreationInput";
import {
    getNodeIcon,
    getDestinationFolder,
    getFileName,
    saveDroppedSqlFile,
} from "./utils";

interface FileTreeItemProps {
    node: FileNode;
    depth: number;
    isExpanded: boolean;
    isSelected: boolean;
    creatingState: { type: "file" | "folder"; parentPath: string } | null;
    onSelect: (path: string, nodeType: string) => void;
    onOpenFile: (path: string, name: string) => void;
    onCreateRequest: (type: "file" | "folder", parentPath: string) => void;
    onCreateSubmit: (name: string) => void;
    onCancelCreate: () => void;
    onMove: (src: string, dest: string) => void;
    tree: FileNode[] | undefined;
    writeFile: ReturnType<typeof useWriteFile>;
    children?: React.ReactNode;
}

export function FileTreeItem({
    node,
    depth,
    isExpanded,
    isSelected,
    creatingState,
    onSelect,
    onOpenFile,
    onCreateRequest,
    onCreateSubmit,
    onCancelCreate,
    onMove,
    tree,
    writeFile,
    children,
}: FileTreeItemProps) {
    const renameNode = useRenameNode();
    const deleteNode = useDeleteNode();

    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");

    const isFolder = node.type === "folder";
    const isRenaming = renamingPath === node.path;
    const isCreatingHere = creatingState && creatingState.parentPath === node.path;

    const handleRename = (path: string) => {
        if (!renameValue.trim()) {
            setRenamingPath(null);
            return;
        }
        renameNode.mutate({ path, newName: renameValue });
        setRenamingPath(null);
        setRenameValue("");
    };

    const handleDragStart = (e: React.DragEvent, path: string) => {
        e.dataTransfer.setData("application/datacia-node", path);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer.files);
        const sqlFile = files.find((file) => file.name.endsWith(".sql"));

        if (sqlFile) {
            await saveDroppedSqlFile(sqlFile, getDestinationFolder(node), tree, writeFile);
            return;
        }

        const srcPath = e.dataTransfer.getData("application/datacia-node");
        if (!srcPath) return;

        const destFolder = getDestinationFolder(node);
        const fileName = getFileName(srcPath);
        const newPath = destFolder ? `${destFolder}/${fileName}` : fileName;

        onMove(srcPath, newPath);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(node.path, node.type);
        if (!isFolder) {
            onOpenFile(node.path, node.name);
        }
    };

    return (
        <div>
            <ContextMenu>
                <ContextMenuTrigger>
                    <div
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-sm cursor-pointer group
                            ${isSelected
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                            }`}
                        style={{ paddingLeft: `${(depth * 12) + 8}px` }}
                        onClick={handleClick}
                        draggable
                        onDragStart={(e) => handleDragStart(e, node.path)}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onDrop={handleDrop}
                    >
                        {getNodeIcon(node.type, isExpanded)}

                        {isRenaming ? (
                            <Input
                                autoFocus
                                className="h-5 py-0 px-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRename(node.path);
                                    if (e.key === "Escape") setRenamingPath(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={() => handleRename(node.path)}
                            />
                        ) : (
                            <span className="truncate">{node.name}</span>
                        )}
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48 p-1">
                    <ContextMenuItem onSelect={() => onCreateRequest("file", getDestinationFolder(node))} className="gap-2 text-xs py-1">
                        <FilePlus className="h-3 w-3" />
                        New Query
                    </ContextMenuItem>

                    {isFolder && (
                        <ContextMenuItem onSelect={() => onCreateRequest("folder", node.path)} className="gap-2 text-xs py-1">
                            <FolderPlus className="h-3 w-3" />
                            New Folder
                        </ContextMenuItem>
                    )}

                    <ContextMenuSeparator />

                    <ContextMenuItem onSelect={() => {
                        setRenamingPath(node.path);
                        setRenameValue(node.name);
                    }} className="gap-2 text-xs py-1">
                        <Edit2 className="h-3 w-3" />
                        Rename
                    </ContextMenuItem>
                    <ContextMenuItem
                        className="gap-2 text-xs py-1 text-red-500 focus:text-red-500"
                        onSelect={(e) => {
                            e.stopPropagation();
                            deleteNode.mutate(node.path);
                        }}
                    >
                        <Trash2 className="h-3 w-3" />
                        Delete
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>

            {isFolder && isExpanded && (
                <>
                    {isCreatingHere && (
                        <div
                            className="flex items-center gap-1.5 px-2 py-1"
                            style={{ paddingLeft: `${((depth + 1) * 12) + 8}px` }}
                        >
                            {getNodeIcon(creatingState.type)}
                            <CreationInput onSubmit={onCreateSubmit} onCancel={onCancelCreate} />
                        </div>
                    )}

                    {children}
                </>
            )}
        </div>
    );
}
