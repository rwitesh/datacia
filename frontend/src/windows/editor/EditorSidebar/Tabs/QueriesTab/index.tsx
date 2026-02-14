import { useState } from "react";
import { Loader2, FilePlus, FolderPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useGetQueriesTree,
  useCreateFolder,
  useCreateQueryFile,
  useReadFile,
  useMoveNode,
  useWriteFile,
} from "@/services/queries";
import { useEditorContext } from "@/context/editor/Index";
import { toast } from "sonner";
import { CreationInput } from "../utils/CreationInput";
import { FileTree } from "./FileTree";
import type { FileNode } from "@/services/bindings";
import {
  getNodeIcon,
  findAvailableFileName,
  getFileName,
  getParentPath,
} from "./utils";

export function QueriesTab() {
  const { data: tree, isLoading, refetch } = useGetQueriesTree();
  const createFolder = useCreateFolder();
  const createQueryFile = useCreateQueryFile();
  const moveNode = useMoveNode();
  const { createTab, updateTab } = useEditorContext();
  const readFile = useReadFile();
  const writeFile = useWriteFile();

  // State for creation. parentPath empty string means root.
  const [creatingState, setCreatingState] = useState<{
    type: "file" | "folder";
    parentPath: string;
  } | null>(null);

  // For handling folder expansion
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );

  // Track selected item (folder or file path)
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // Helper to check if a path is a folder
  const isFolder = (path: string): boolean => {
    const findNode = (
      nodes: FileNode[] | undefined,
      targetPath: string,
    ): FileNode | null => {
      if (!nodes) return null;
      for (const node of nodes) {
        if (node.path === targetPath) return node;
        if (node.children) {
          const found = findNode(node.children, targetPath);
          if (found) return found;
        }
      }
      return null;
    };
    const node = findNode(tree, path);
    return node?.type === "folder";
  };

  // Get parent path for creation based on selection
  const getCreationParentPath = (): string => {
    if (!selectedPath) return "";
    // If selected is a folder, create inside it
    if (isFolder(selectedPath)) return selectedPath;
    // If selected is a file, create in its parent folder
    return getParentPath(selectedPath);
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        // When collapsing, also remove all child paths
        next.delete(path);
        for (const expandedPath of prev) {
          if (expandedPath.startsWith(path + "/")) {
            next.delete(expandedPath);
          }
        }
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleSelect = (path: string, nodeType: string) => {
    setSelectedPath(path);
    if (nodeType === "folder") {
      toggleFolder(path);
    }
  };

  const handleCreateSubmit = async (name: string) => {
    if (!creatingState || !name.trim()) {
      setCreatingState(null);
      return;
    }

    const { type, parentPath } = creatingState;
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
    if (dest.startsWith(src + "/")) return;
    moveNode.mutate({ src, dest });
  };

  const handleCreateInSelectedFolder = (type: "file" | "folder") => {
    const parentPath = getCreationParentPath();
    setCreatingState({ type, parentPath });
    // Ensure the parent folder is expanded
    if (parentPath) {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(parentPath);
        return next;
      });
    }
  };

  // Root Drop Handler
  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const sqlFile = files.find((file) => file.name.endsWith(".sql"));

    if (sqlFile) {
      try {
        const content = await sqlFile.text();
        const fileName = sqlFile.name;
        const availableFileName = findAvailableFileName(fileName, "", tree);

        writeFile.mutate(
          { path: availableFileName, content },
          {
            onSuccess: () => {
              toast.success(`File saved as ${availableFileName}`);
            },
            onError: (err: Error) => {
              toast.error(err.message || "Failed to save file");
            },
          },
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to read file";
        toast.error(message);
      }
      return;
    }

    const srcPath = e.dataTransfer.getData("application/datacia-node");
    if (!srcPath) return;

    const fileName = getFileName(srcPath);
    if (!srcPath.includes("/")) return;

    handleMove(srcPath, fileName);
  };

  // Clear selection when clicking on empty area (but not when creating)
  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !creatingState) {
      setSelectedPath(null);
    }
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
        <span className="font-medium text-muted-foreground">Queries</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 cursor-pointer"
            onClick={() => handleCreateInSelectedFolder("file")}
            title="New Query"
          >
            <FilePlus className="h-4 w-4" strokeWidth={1} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 cursor-pointer"
            onClick={() => handleCreateInSelectedFolder("folder")}
            title="New Folder"
          >
            <FolderPlus className="h-4 w-4" strokeWidth={1} />
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

      <div
        className="flex-1 overflow-y-auto p-1 relative min-h-[100px]"
        onClick={handleContainerClick}
      >
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
          <div className="px-4 py-8 text-center text-muted-foreground pointer-events-none">
            No saved queries.
          </div>
        )}

        {tree && (
          <FileTree
            nodes={tree}
            depth={0}
            expandedFolders={expandedFolders}
            selectedPath={selectedPath}
            onSelect={handleSelect}
            onOpenFile={async (path, name) => {
              readFile.mutate(path, {
                onSuccess: (content: string) => {
                  const tab = createTab(name, "query");
                  updateTab(tab.id, { sql: content, savedPath: path });
                },
              });
            }}
            creatingState={creatingState}
            onCreateRequest={(type, parentPath) => {
              setCreatingState({ type, parentPath });
              if (parentPath) {
                setExpandedFolders((prev) => {
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
          />
        )}
      </div>
    </div>
  );
}
