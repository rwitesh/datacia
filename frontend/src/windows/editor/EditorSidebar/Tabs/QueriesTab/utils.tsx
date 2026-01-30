import {
    FolderIcon,
    FolderOpenIcon,
    FileCode,
} from "lucide-react";
import type { FileNode } from "@/services/bindings";

/**
 * Get icon for a file tree node based on type
 */
export function getNodeIcon(type: string, isExpanded?: boolean) {
    if (type === "folder") {
        return isExpanded
            ? <FolderOpenIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            : <FolderIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    }
    return <FileCode className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
}

/**
 * Check if a file exists in the tree at a given path
 */
export function fileExists(nodes: FileNode[] | undefined, targetPath: string): boolean {
    if (!nodes) return false;
    for (const node of nodes) {
        if (node.path === targetPath) return true;
        if (node.children && fileExists(node.children, targetPath)) return true;
    }
    return false;
}

/**
 * Find an available filename by auto-renaming with _1, _2, etc.
 */
export function findAvailableFileName(
    baseName: string,
    parentPath: string,
    nodes: FileNode[] | undefined
): string {
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
}

/**
 * Find the deepest expanded folder in the tree
 * If a folder is expanded and has expanded children, returns the deepest one
 */
export function findFirstExpandedFolder(
    nodes: FileNode[] | undefined,
    expandedFolders: Set<string>
): string {
    if (!nodes) return "";
    for (const node of nodes) {
        if (node.type === "folder" && expandedFolders.has(node.path)) {
            // First check if there's a deeper expanded folder in children
            if (node.children) {
                const deeperFolder = findFirstExpandedFolder(node.children, expandedFolders);
                if (deeperFolder) return deeperFolder;
            }
            // No deeper folder found, return this one
            return node.path;
        }
        // Also check non-expanded folders' children (in case a nested folder is expanded)
        if (node.children) {
            const found = findFirstExpandedFolder(node.children, expandedFolders);
            if (found) return found;
        }
    }
    return "";
}

/**
 * Get the parent folder path from a file path
 */
export function getParentPath(path: string): string {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/');
}

/**
 * Get the destination folder for a drop target
 * If target is folder, use it. If target is file, use its parent.
 */
export function getDestinationFolder(targetNode: FileNode): string {
    if (targetNode.type === "folder") {
        return targetNode.path;
    }
    return getParentPath(targetNode.path);
}

/**
 * Get the filename from a full path
 */
export function getFileName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1];
}
