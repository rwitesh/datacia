import { formatSQL } from "@/windows/editor/QueryInput/utils/formatter";
import { useAppContext } from "@/context/app/Index";

interface DDLViewProps {
    ddl: string;
    isLoading: boolean;
    error?: string;
}

export function DDLView({ ddl, isLoading, error }: DDLViewProps) {
    const { engine } = useAppContext();

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-full text-red-500">
                {error}
            </div>
        );
    }

    if (!ddl) {
        return (
            <div className="flex justify-center items-center h-full text-muted-foreground">
                No DDL available
            </div>
        );
    }

    const formattedDDL = formatSQL(ddl, engine || "");

    return (
        <div className="h-full overflow-auto p-4">
            <pre className="font-mono text-sm whitespace-pre-wrap bg-muted/50 p-4 rounded-md border">
                {formattedDDL}
            </pre>
        </div>
    );
}
