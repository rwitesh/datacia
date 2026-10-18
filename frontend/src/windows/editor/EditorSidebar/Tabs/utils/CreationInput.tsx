import { useState } from "react";
import { Input } from "@/components/ui/input";

interface CreationInputProps {
    onSubmit: (val: string) => void;
    onCancel: () => void;
}

export function CreationInput({ onSubmit, onCancel }: CreationInputProps) {
    const [val, setVal] = useState("");
    const finish = () => {
        if (val.trim()) onSubmit(val); else onCancel();
    };

    return (
        <Input
            autoFocus
            className="h-5 text-xs border-0 bg-transparent px-0.5 py-0.5 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
            placeholder="name"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={finish}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    finish();
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    onCancel();
                }
            }}
        />
    );
}
