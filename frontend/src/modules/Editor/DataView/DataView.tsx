type SelectedDataProps = {
  selectedData: Array<Record<string, unknown>>;
};

export function DataView({ selectedData }: SelectedDataProps) {
  if (!selectedData.length) {
    return (
      <div className="p-4 text-muted-foreground text-sm">No rows selected</div>
    );
  }

  return (
    <div className="h-full w-full text-xs bg-muted">
      <pre className="h-full w-full overflow-auto whitespace-pre-wrap break-all p-2 rounded bg-background">
        {JSON.stringify(selectedData, null, 2)}
      </pre>
    </div>
  );
}
