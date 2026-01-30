import { useWriteFile } from "@/services/queries";
import type { FileNode } from "@/services/bindings";
import { FileTreeItem } from "./FileTreeItem";

interface FileTreeProps {
    nodes: FileNode[];
    depth: number;
    expandedFolders: Set<string>;
    selectedPath: string | null;
    onSelect: (path: string, nodeType: string) => void;
    onOpenFile: (path: string, name: string) => void;
    creatingState: { type: "file" | "folder"; parentPath: string } | null;
    onCreateRequest: (type: "file" | "folder", parentPath: string) => void;
    onCreateSubmit: (name: string) => void;
    onCancelCreate: () => void;
    onMove: (src: string, dest: string) => void;
    tree: FileNode[] | undefined;
    writeFile: ReturnType<typeof useWriteFile>;
}

export function FileTree({
    nodes,
    depth,
    expandedFolders,
    selectedPath,
    onSelect,
    onOpenFile,
    creatingState,
    onCreateRequest,
    onCreateSubmit,
    onCancelCreate,
    onMove,
    tree,
    writeFile,
}: FileTreeProps) {
    return (
        <div className="flex flex-col select-none">
            {nodes.map((node) => {
                const isExpanded = expandedFolders.has(node.path);
                const isSelected = selectedPath === node.path;

                return (
                    <FileTreeItem
                        key={node.path}
                        node={node}
                        depth={depth}
                        isExpanded={isExpanded}
                        isSelected={isSelected}
                        creatingState={creatingState}
                        onSelect={onSelect}
                        onOpenFile={onOpenFile}
                        onCreateRequest={onCreateRequest}
                        onCreateSubmit={onCreateSubmit}
                        onCancelCreate={onCancelCreate}
                        onMove={onMove}
                        tree={tree}
                        writeFile={writeFile}
                    >
                        {node.children && (
                            <FileTree
                                nodes={node.children}
                                depth={depth + 1}
                                expandedFolders={expandedFolders}
                                selectedPath={selectedPath}
                                onSelect={onSelect}
                                onOpenFile={onOpenFile}
                                creatingState={creatingState}
                                onCreateRequest={onCreateRequest}
                                onCreateSubmit={onCreateSubmit}
                                onCancelCreate={onCancelCreate}
                                onMove={onMove}
                                tree={tree}
                                writeFile={writeFile}
                            />
                        )}
                    </FileTreeItem>
                );
            })}
        </div>
    );
}
