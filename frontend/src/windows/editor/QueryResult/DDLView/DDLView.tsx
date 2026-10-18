import { useMemo } from "react";

import { formatSQL } from "@/windows/editor/QueryInput/utils/formatter";
import { SQLCodeEditor } from "@/windows/editor/QueryInput/SQLCodeEditor";
import { useAppContext } from "@/context/app/Index";

interface DDLViewProps {
  ddl: string;
  isLoading: boolean;
  error?: string;
}

export function DDLView({ ddl, isLoading, error }: DDLViewProps) {
  const { engine } = useAppContext();

  const formattedDDL = useMemo(
    () => (ddl ? formatSQL(ddl, engine || "") : ""),
    [ddl, engine]
  );

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

  return (
    <div className="h-full p-4">
      <SQLCodeEditor
        readOnly
        value={formattedDDL}
        className="font-mono text-sm bg-muted/50 p-4 rounded-md border text-left [&_.cm-editor]:outline-none"
      />
    </div>
  );
}
