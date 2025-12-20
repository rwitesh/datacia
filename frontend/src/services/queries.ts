
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ListTree,
    CreateFolder,
    CreateQueryFile,
    Rename,
    Delete,
    ReadFile,
    WriteFile,
    Move
} from "./bindings";
import type { FileNode } from "./bindings";
import { toast } from "sonner";

export const useGetQueriesTree = () => {
    return useQuery<FileNode[]>({
        queryKey: ["queries-tree"],
        queryFn: ListTree,
    });
};

export const useCreateFolder = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, string>({
        mutationFn: CreateFolder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["queries-tree"] });
        },
        onError: (err: Error) => {
            console.error(err.message || "Failed to create folder");
        }
    });
};

export const useCreateQueryFile = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, string>({
        mutationFn: CreateQueryFile,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["queries-tree"] });
        },
        onError: (err: Error) => {
            console.error(err.message || "Failed to create file");
        }
    });
};

export const useRenameNode = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, { path: string; newName: string }>({
        mutationFn: ({ path, newName }) => Rename(path, newName),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["queries-tree"] });
        },
        onError: (err: Error) => {
            console.error(err.message || "Failed to rename");
        }
    });
};

export const useMoveNode = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, { src: string; dest: string }>({
        mutationFn: ({ src, dest }) => Move(src, dest),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["queries-tree"] });
        },
        onError: (err: Error) => {
            console.error(err.message || "Failed to move");
        }
    });
};

export const useDeleteNode = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, string>({
        mutationFn: Delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["queries-tree"] });
        },
        onError: (err: Error) => {
            console.error(err.message || "Failed to delete");
        }
    });
};

export const useReadFile = () => {
    return useMutation<string, Error, string>({
        mutationFn: ReadFile,
        onError: (err: Error) => {
            console.error(err.message || "Failed to read file");
        }
    });
};

export const useWriteFile = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, { path: string; content: string }>({
        mutationFn: ({ path, content }) => WriteFile(path, content),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["queries-tree"] });
            toast.success("File saved");
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to save file");
        }
    });
};
