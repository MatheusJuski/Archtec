import { cn } from "@/lib/utils"

interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Título do painel, renderizado como etiqueta */
  title?: React.ReactNode
  /** Conteúdo à direita do cabeçalho */
  aside?: React.ReactNode
  /** Fundo hachurado sutil */
  hatched?: boolean
  /** Remove o padding do corpo */
  flush?: boolean
  as?: "section" | "div" | "article"
}

/** Superfície reta com borda em tinta — substitui os cards arredondados. */
export function Panel({
  title,
  aside,
  hatched,
  flush,
  as: Comp = "section",
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <Comp
      className={cn(
        "relative border border-ink bg-card",
        hatched && "hatch",
        className,
      )}
      {...props}
    >
      {(title || aside) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          {title && <h2 className="chip chip-offset">{title}</h2>}
          {aside && <div className="flex items-center gap-2 text-muted-foreground">{aside}</div>}
        </header>
      )}
      <div className={cn(!flush && "p-4")}>{children}</div>
    </Comp>
  )
}
