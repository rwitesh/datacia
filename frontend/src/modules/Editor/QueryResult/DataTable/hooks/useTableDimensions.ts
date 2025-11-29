import { useState, useLayoutEffect, type RefObject } from "react";

export function useTableDimensions(containerRef: RefObject<HTMLDivElement | null>) {
    const [containerWidth, setContainerWidth] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    useLayoutEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver(([entry]) => {
            setContainerWidth(entry.contentRect.width);
            setContainerHeight(entry.contentRect.height);
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [containerRef]);

    return { containerWidth, containerHeight };
}
