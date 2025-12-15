import { useState } from "react";
import {
    FolderIcon,
    FolderOpenIcon,
    Trash2,
    Edit2,
    Loader2,
    FilePlus,
    FolderPlus,
    FileCode,
    RefreshCw
} from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSeparator
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    useGetQueriesTree,
    useCreateFolder,
    useCreateQueryFile,
    useRenameNode,
    useDeleteNode,
    useReadFile,
    useMoveNode,
    useWriteFile
} from "@/services/queries";
import { useEditorContext } from "@/modules/Context/Editor/Index";
import type { FileNode } from "@/services/bindings";
import { toast } from "sonner";

export function QueriesTab() {
    const { data: tree, isLoading, refetch } = useGetQueriesTree();
    const createFolder = useCreateFolder();
    const createQueryFile = useCreateQueryFile();
    const moveNode = useMoveNode();
    const { createTab, updateTab } = useEditorContext();
    const readFile = useReadFile();
    const writeFile = useWriteFile();

    // State for creation. parentPath empty string means root.
    const [creatingState, setCreatingState] = useState<{ type: "file" | "folder", parentPath: string } | null>(null);

    // For handling double click to expand folders
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const toggleFolder = (path: string) => {
        const next = new Set(expandedFolders);
        if (next.has(path)) {
            next.delete(path);
        } else {
            next.add(path);
        }
        setExpandedFolders(next);
    };

    const handleCreateSubmit = async (name: string) => {
        if (!creatingState || !name.trim()) {
            setCreatingState(null);
            return;
        }

        const { type, parentPath } = creatingState;
        // Construct full relative path
        // If parentPath is "", it's just name.
        // If parentPath is "foo", it's "foo/name".
        const fullPath = parentPath ? `${parentPath}/${name}` : name;

        if (type === "folder") {
            createFolder.mutate(fullPath);
        } else {
            createQueryFile.mutate(fullPath);
        }
        setCreatingState(null);
    };

    const handleMove = (src: string, dest: string) => {
        if (src === dest) return;
        // Don't allow moving parent into child
        if (dest.startsWith(src + "/")) return;

        moveNode.mutate({ src, dest });
    };

    // Helper function to check if a file exists in the tree at a given path
    const fileExists = (nodes: FileNode[] | undefined, targetPath: string): boolean => {
        if (!nodes) return false;
        for (const node of nodes) {
            if (node.path === targetPath) return true;
            if (node.children && fileExists(node.children, targetPath)) return true;
        }
        return false;
    };

    // Helper function to find an available filename by auto-renaming
    const findAvailableFileName = (baseName: string, parentPath: string, nodes: FileNode[] | undefined): string => {
        const basePath = parentPath ? `${parentPath}/${baseName}` : baseName;
        if (!fileExists(nodes, basePath)) {
            return baseName;
        }

        // Extract name and extension
        const lastDot = baseName.lastIndexOf('.');
        const nameWithoutExt = lastDot > 0 ? baseName.substring(0, lastDot) : baseName;
        const ext = lastDot > 0 ? baseName.substring(lastDot) : '';

        // Try _1, _2, etc.
        let counter = 1;
        while (true) {
            const newName = `${nameWithoutExt}_${counter}${ext}`;
            const newPath = parentPath ? `${parentPath}/${newName}` : newName;
            if (!fileExists(nodes, newPath)) {
                return newName;
            }
            counter++;
            // Safety limit
            if (counter > 1000) break;
        }
        return baseName; // Fallback
    };

    // Root Drop Handler
    const handleRootDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Check for external file drop first
        const files = Array.from(e.dataTransfer.files);
        const sqlFile = files.find((file) => file.name.endsWith(".sql"));

        if (sqlFile) {
            // External file drop - save to root
            try {
                const content = await sqlFile.text();
                const fileName = sqlFile.name;
                const availableFileName = findAvailableFileName(fileName, "", tree);
                const targetPath = availableFileName;

                writeFile.mutate(
                    { path: targetPath, content },
                    {
                        onSuccess: () => {
                            toast.success(`File saved as ${availableFileName}`);
                        },
                        onError: (err: Error) => {
                            toast.error(err.message || "Failed to save file");
                        }
                    }
                );
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Failed to read file";
                toast.error(message);
            }
            return;
        }

        // Internal node move
        const srcPath = e.dataTransfer.getData("application/datacia-node");
        if (!srcPath) return;

        // Move to root means dest is just the file name
        // extracting filename
        const parts = srcPath.split('/');
        const fileName = parts[parts.length - 1];

        // If it's already at root (no slashes), do nothing
        if (!srcPath.includes('/')) return;

        handleMove(srcPath, fileName);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div
            className="flex flex-col h-full"
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onDrop={handleRootDrop}
        >
            <div className="px-2 border-sidebar-border flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Queries</span>
                <div className="flex items-center gap-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 cursor-pointer"
                        onClick={() => setCreatingState({ type: "folder", parentPath: "" })}
                        title="New Folder"
                    >
                        <FolderPlus className="h-4 w-4" strokeWidth={1} />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 cursor-pointer"
                        onClick={() => setCreatingState({ type: "file", parentPath: "" })}
                        title="New Query"
                    >
                        <FilePlus className="h-4 w-4" strokeWidth={1} />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 cursor-pointer"
                        onClick={() => refetch()}
                        title="Refresh"
                    >
                        <RefreshCw className="h-4 w-4" strokeWidth={1} />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1 relative min-h-[100px]">
                {/* Inline input for Root creation */}
                {creatingState && creatingState.parentPath === "" && (
                    <div className="px-2 py-1 flex items-center gap-2 mb-1">
                        {getNodeIcon(creatingState.type)}
                        <CreationInput
                            onSubmit={handleCreateSubmit}
                            onCancel={() => setCreatingState(null)}
                        />
                    </div>
                )}

                {(!tree || tree.length === 0) && !creatingState && (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground pointer-events-none">
                        No saved queries. <br /> Right click or use + to add.
                    </div>
                )}

                {tree && <FileTree
                    nodes={tree}
                    depth={0}
                    expandedFolders={expandedFolders}
                    onToggleFolder={toggleFolder}
                    onOpenFile={async (path, name) => {
                        readFile.mutate(path, {
                            onSuccess: (content: string) => {
                                const tab = createTab(name, "query");
                                updateTab(tab.id, { sql: content, savedPath: path });
                            }
                        })
                    }}
                    creatingState={creatingState}
                    onCreateRequest={(type, parentPath) => {
                        setCreatingState({ type, parentPath });
                        // If creating in a folder, ensure it is expanded
                        if (parentPath) {
                            setExpandedFolders(prev => {
                                const next = new Set(prev);
                                next.add(parentPath);
                                return next;
                            });
                        }
                    }}
                    onCreateSubmit={handleCreateSubmit}
                    onCancelCreate={() => setCreatingState(null)}
                    onMove={handleMove}
                    tree={tree}
                    writeFile={writeFile}
                    findAvailableFileName={findAvailableFileName}
                    fileExists={fileExists}
                />}
            </div>
        </div>
    );
}

function CreationInput({ onSubmit, onCancel }: { onSubmit: (val: string) => void, onCancel: () => void }) {
    const [val, setVal] = useState("");
    return (
        <Input
            autoFocus
            className="h-6 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit(val);
                if (e.key === "Escape") onCancel();
            }}
            onBlur={() => {
                if (val.trim()) onSubmit(val); else onCancel();
            }}
        />
    )
}

// Helper function to get icon based on node type
function getNodeIcon(type: string, isExpanded?: boolean) {
    if (type === "folder") {
        return isExpanded
            ? <FolderOpenIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            : <FolderIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    }
    return <FileCode className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
}

interface FileTreeProps {
    nodes: FileNode[];
    depth: number;
    expandedFolders: Set<string>;
    onToggleFolder: (path: string) => void;
    onOpenFile: (path: string, name: string) => void;

    creatingState: { type: "file" | "folder", parentPath: string } | null;
    onCreateRequest: (type: "file" | "folder", parentPath: string) => void;
    onCreateSubmit: (name: string) => void;
    onCancelCreate: () => void;
    onMove: (src: string, dest: string) => void;
    tree: FileNode[] | undefined;
    writeFile: ReturnType<typeof useWriteFile>;
    findAvailableFileName: (baseName: string, parentPath: string, nodes: FileNode[] | undefined) => string;
    fileExists: (nodes: FileNode[] | undefined, targetPath: string) => boolean;
}

function FileTree({
    nodes,
    depth,
    expandedFolders,
    onToggleFolder,
    onOpenFile,
    creatingState,
    onCreateRequest,
    onCreateSubmit,
    onCancelCreate,
    onMove,
    tree,
    writeFile,
    findAvailableFileName,
    fileExists
}: FileTreeProps) {
    const renameNode = useRenameNode();
    const deleteNode = useDeleteNode();

    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");

    const handleRename = (path: string) => {
        if (!renameValue.trim()) {
            setRenamingPath(null);
            return;
        }
        renameNode.mutate({ path, newName: renameValue });
        setRenamingPath(null);
        setRenameValue("");
    };

    // Drag Handlers
    const handleDragStart = (e: React.DragEvent, path: string) => {
        e.dataTransfer.setData("application/datacia-node", path);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDrop = async (e: React.DragEvent, targetNode: FileNode) => {
        e.preventDefault();
        e.stopPropagation();

        // Check for external file drop first
        const files = Array.from(e.dataTransfer.files);
        const sqlFile = files.find((file) => file.name.endsWith(".sql"));

        if (sqlFile) {
            // External file drop - save to target folder
            try {
                const content = await sqlFile.text();
                const fileName = sqlFile.name;

                // Determine destination folder
                // If target is folder, save INTO it.
                // If target is file, save INTO its parent folder.
                let destFolder = "";
                if (targetNode.type === "folder") {
                    destFolder = targetNode.path;
                } else {
                    const parts = targetNode.path.split('/');
                    parts.pop();
                    destFolder = parts.join('/');
                }

                const availableFileName = findAvailableFileName(fileName, destFolder, tree);
                const targetPath = destFolder ? `${destFolder}/${availableFileName}` : availableFileName;

                writeFile.mutate(
                    { path: targetPath, content },
                    {
                        onSuccess: () => {
                            toast.success(`File saved as ${availableFileName}`);
                        },
                        onError: (err: Error) => {
                            toast.error(err.message || "Failed to save file");
                        }
                    }
                );
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Failed to read file";
                toast.error(message);
            }
            return;
        }

        // Internal node move
        const srcPath = e.dataTransfer.getData("application/datacia-node");
        if (!srcPath) return;

        // Determine destination folder
        // If target is folder, move INTO it.
        // If target is file, move INTO its parent folder.
        let destFolder = "";
        if (targetNode.type === "folder") {
            destFolder = targetNode.path;
        } else {
            const parts = targetNode.path.split('/');
            parts.pop();
            destFolder = parts.join('/');
        }

        // Construct new path
        const srcParts = srcPath.split('/');
        const fileName = srcParts[srcParts.length - 1];

        let newPath = fileName;
        if (destFolder) {
            newPath = `${destFolder}/${fileName}`;
        }

        onMove(srcPath, newPath);
    };

    return (
        <div className="flex flex-col select-none">
            {nodes.map((node) => {
                const isFolder = node.type === "folder";
                const isExpanded = expandedFolders.has(node.path);
                const isRenaming = renamingPath === node.path;
                const isCreatingHere = creatingState && creatingState.parentPath === node.path;

                return (
                    <div key={node.path}>
                        <ContextMenu>
                            <ContextMenuTrigger>
                                <div
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer text-xs group"
                                    style={{ paddingLeft: `${(depth * 12) + 8}px` }}
                                    onClick={() => {
                                        if (isFolder) {
                                            onToggleFolder(node.path);
                                        } else {
                                            onOpenFile(node.path, node.name);
                                        }
                                    }}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, node.path)}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation(); // Stop propagation to allow nested drops
                                    }}
                                    onDrop={(e) => handleDrop(e, node)}
                                >
                                    {getNodeIcon(node.type, isExpanded)}

                                    {isRenaming ? (
                                        <Input
                                            autoFocus
                                            className="h-5 text-xs py-0 px-1 focus-visible:ring-0 focus-visible:ring-offset-0"
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
                            <ContextMenuContent>
                                <ContextMenuItem onSelect={() => onCreateRequest("file", isFolder ? node.path : (node.path.split('/').slice(0, -1).join('/')))}>
                                    <FilePlus className="h-3 w-3 mr-2" />
                                    New Query
                                </ContextMenuItem>

                                {isFolder && (
                                    <ContextMenuItem onSelect={() => onCreateRequest("folder", node.path)}>
                                        <FolderPlus className="h-3 w-3 mr-2" />
                                        New Folder
                                    </ContextMenuItem>
                                )}

                                <ContextMenuSeparator />

                                <ContextMenuItem onSelect={() => {
                                    setRenamingPath(node.path);
                                    setRenameValue(node.name);
                                }}>
                                    <Edit2 className="h-3 w-3 mr-2" />
                                    Rename
                                </ContextMenuItem>
                                <ContextMenuItem
                                    className="text-red-500 focus:text-red-500"
                                    onSelect={(e) => {
                                        e.stopPropagation();
                                        deleteNode.mutate(node.path);

                                    }}
                                >
                                    <Trash2 className="h-3 w-3 mr-2" />
                                    Delete
                                </ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>

                        {/* Rendering children and creation input if this folder is expanded */}
                        {isFolder && isExpanded && (
                            <>
                                {/* Inline input if creating inside this folder */}
                                {isCreatingHere && (
                                    <div
                                        className="flex items-center gap-1.5 px-2 py-1"
                                        style={{ paddingLeft: `${((depth + 1) * 12) + 8}px` }}
                                    >
                                        {getNodeIcon(creatingState.type)}
                                        <CreationInput onSubmit={onCreateSubmit} onCancel={onCancelCreate} />
                                    </div>
                                )}

                                {node.children && (
                                    <FileTree
                                        nodes={node.children}
                                        depth={depth + 1}
                                        expandedFolders={expandedFolders}
                                        onToggleFolder={onToggleFolder}
                                        onOpenFile={onOpenFile}
                                        creatingState={creatingState}
                                        onCreateRequest={onCreateRequest}
                                        onCreateSubmit={onCreateSubmit}
                                        onCancelCreate={onCancelCreate}
                                        onMove={onMove}
                                        tree={tree}
                                        writeFile={writeFile}
                                        findAvailableFileName={findAvailableFileName}
                                        fileExists={fileExists}
                                    />
                                )}
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
