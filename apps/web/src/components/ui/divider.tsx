import { cn } from "@/lib/utils"

interface DividerProps {
  label?: React.ReactNode
  orientation?: "horizontal" | "vertical"
  className?: string
}

/** Linha fina com terminais quadrados; aceita um rótulo opcional no centro. */
export function Divider({ label, orientation = "horizontal", className }: DividerProps) {
  if (orientation === "vertical") {
    return (
      <div aria-hidden className={cn("flex flex-col items-center self-stretch", className)}>
        <span className="size-[7px] shrink-0 bg-ink" />
        <span className="w-px flex-1 bg-line" />
        <span className="size-[7px] shrink-0 bg-ink" />
      </div>
    )
  }

  return (
    <div
      role="separator"
      className={cn("flex items-center gap-3 text-muted-foreground", className)}
    >
      <span aria-hidden className="size-[7px] shrink-0 bg-ink" />
      <span aria-hidden className="h-px flex-1 bg-line" />
      {label && (
        <>
          <span className="label-tech">{label}</span>
          <span aria-hidden className="h-px flex-1 bg-line" />
        </>
      )}
      <span aria-hidden className="size-[7px] shrink-0 bg-ink" />
    </div>
  )
}
