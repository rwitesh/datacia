import { useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";

interface CreationInputProps {
    onSubmit: (val: string) => void;
    onCancel: () => void;
}

export function CreationInput({ onSubmit, onCancel }: CreationInputProps) {
    const [val, setVal] = useState("");
    const mountedRef = useRef(false);

    // Mark as mounted after first focus
    const handleFocus = useCallback(() => {
        mountedRef.current = true;
    }, []);

    const handleBlur = useCallback(() => {
        // Only handle blur if the input has been focused at least once
        if (!mountedRef.current) return;
        if (val.trim()) onSubmit(val); else onCancel();
    }, [val, onSubmit, onCancel]);

    return (
        <Input
            autoFocus
            className="h-5 text-xs border-0 bg-transparent px-0.5 py-0.5 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
            placeholder="name"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    if (val.trim()) onSubmit(val); else onCancel();
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    onCancel();
                }
            }}
        />
    );
}
