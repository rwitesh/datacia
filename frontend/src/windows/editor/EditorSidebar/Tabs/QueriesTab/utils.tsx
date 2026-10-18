import {
    FolderIcon,
    FolderOpenIcon,
    FileCode,
} from "lucide-react";
import { toast } from "sonner";
import type { FileNode } from "@/services/bindings";
import type { useWriteFile } from "@/services/queries";
import { errorMessage } from "@/lib/utils";

export function getNodeIcon(type: string, isExpanded?: boolean) {
    if (type === "folder") {
        return isExpanded
            ? <FolderOpenIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            : <FolderIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    }
    return <FileCode className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
}

export function findNode(nodes: FileNode[] | undefined, path: string): FileNode | undefined {
    for (const node of nodes ?? []) {
        if (node.path === path) return node;
        const found = findNode(node.children, path);
        if (found) return found;
    }
    return undefined;
}

// findAvailableFileName returns baseName, or the first free name_1.ext,
// name_2.ext, ... in parentPath.
function findAvailableFileName(
    baseName: string,
    parentPath: string,
    nodes: FileNode[] | undefined
): string {
    const lastDot = baseName.lastIndexOf(".");
    const nameWithoutExt = lastDot > 0 ? baseName.substring(0, lastDot) : baseName;
    const ext = lastDot > 0 ? baseName.substring(lastDot) : "";
    for (let counter = 0; ; counter++) {
        const name = counter === 0 ? baseName : `${nameWithoutExt}_${counter}${ext}`;
        if (!findNode(nodes, parentPath ? `${parentPath}/${name}` : name)) return name;
    }
}

export function getParentPath(path: string): string {
    const parts = path.split("/");
    parts.pop();
    return parts.join("/");
}

// getDestinationFolder is the folder a drop on targetNode lands in: the
// folder itself, or a file's parent.
export function getDestinationFolder(targetNode: FileNode): string {
    if (targetNode.type === "folder") {
        return targetNode.path;
    }
    return getParentPath(targetNode.path);
}

export function getFileName(path: string): string {
    const parts = path.split("/");
    return parts[parts.length - 1];
}

// saveDroppedSqlFile saves a .sql file dropped from outside the app into
// folder ("" is the root), renaming it if the name is taken.
export async function saveDroppedSqlFile(
    file: File,
    folder: string,
    tree: FileNode[] | undefined,
    writeFile: ReturnType<typeof useWriteFile>
) {
    try {
        const content = await file.text();
        const fileName = findAvailableFileName(file.name, folder, tree);
        writeFile.mutate({ path: folder ? `${folder}/${fileName}` : fileName, content });
    } catch (err) {
        toast.error(errorMessage(err));
    }
}
