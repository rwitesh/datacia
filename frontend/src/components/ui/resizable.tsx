import * as React from "react"
import { GripVerticalIcon } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

type Size = number | string | undefined

// react-resizable-panels v4 treats numeric sizes as pixels; this wrapper keeps
// the previous behaviour of numbers meaning percentages.
const toPercent = (size: Size) => (typeof size === "number" ? `${size}%` : size)

function ResizablePanelGroup({
  className,
  direction = "horizontal",
  ...props
}: Omit<React.ComponentProps<typeof ResizablePrimitive.Group>, "orientation"> & {
  direction?: "horizontal" | "vertical"
}) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      data-panel-group-direction={direction}
      orientation={direction}
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel({
  defaultSize,
  minSize,
  maxSize,
  collapsedSize,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return (
    <ResizablePrimitive.Panel
      data-slot="resizable-panel"
      defaultSize={toPercent(defaultSize)}
      minSize={toPercent(minSize)}
      maxSize={toPercent(maxSize)}
      collapsedSize={toPercent(collapsedSize)}
      {...props}
    />
  )
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 after:cursor-col-resize focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:cursor-row-resize aria-[orientation=horizontal]:after:cursor-row-resize aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
