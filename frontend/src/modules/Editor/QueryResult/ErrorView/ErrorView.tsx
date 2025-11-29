import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

type ErrorViewProps = {
    error: string;
};

export function ErrorView({ error }: ErrorViewProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-background/50">
            <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                    mass: 0.8
                }}
                className="w-full"
            >
                <div className="p-8 flex flex-col items-center text-center">
                    <div className="mb-6">
                        <div className="p-3 rounded-full bg-red-500/10 dark:bg-red-500/20 ring-2 ring-red-500/30 dark:ring-red-400/30">
                            <AlertTriangle className="w-8 h-8 text-red-500 dark:text-red-400 stroke-[1.5]" />
                        </div>
                    </div>

                    <h3 className="text-lg font-medium text-foreground mb-2 tracking-tight">
                        Query Execution Failed
                    </h3>

                    <div className="w-full mt-4 relative">
                        <div className="max-h-[200px] overflow-y-auto rounded-lg bg-red-50/50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 p-4 text-sm font-mono text-red-600 dark:text-red-300 break-words text-left">
                            {error}
                        </div>
                    </div>

                    <p className="mt-6 text-xs text-muted-foreground/60">
                        Check your syntax and try again
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
