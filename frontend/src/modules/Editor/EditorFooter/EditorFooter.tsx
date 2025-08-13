export const EditorFooter = ({rowCount}: {rowCount : number}) => {
    return (
        <div className="flex items-center justify-end px-3 py-1 bg-background text-xs text-muted-foreground w-full cursor-default gap-1">
             {rowCount != null ? `${rowCount} rows` : ""}
        </div>
    )
}