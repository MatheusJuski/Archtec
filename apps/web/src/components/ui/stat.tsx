import { cn } from "@/lib/utils"

type Tone = "default" | "brand" | "signal" | "success" | "danger"

const toneBar: Record<Tone, string> = {
  default: "bg-ink",
  brand: "bg-brand",
  signal: "bg-signal",
  success: "bg-success",
  danger: "bg-destructive",
}

const toneText: Record<Tone, string> = {
  default: "text-foreground",
  brand: "text-brand",
  signal: "text-foreground",
  success: "text-success",
  danger: "text-destructive",
}

interface StatProps {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
  tone?: Tone
  className?: string
}

/** Indicador numérico: rótulo técnico, valor em mono e barra de tom. */
export function Stat({ label, value, hint, icon, tone = "default", className }: StatProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between gap-4 border border-line bg-card p-4 transition-[border-color,transform,box-shadow] duration-200 ease-[var(--ease-snap)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-ink hover:shadow-hard",
        className,
      )}
    >
      <span aria-hidden className={cn("absolute left-0 top-0 h-[3px] w-8 transition-[width] duration-300 group-hover:w-full", toneBar[tone])} />
      <div className="flex items-start justify-between gap-2">
        <p className="label-tech text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
      </div>
      <div>
        <p className={cn("font-mono text-2xl font-medium tabular-nums tracking-tight", toneText[tone])}>
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}
