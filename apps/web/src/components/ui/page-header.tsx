import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { Divider } from "@/components/ui/divider"

interface PageHeaderProps {
  /** Rótulo técnico acima do título, ex.: "02 / Tarefas" */
  eyebrow?: string
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-8", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <motion.p
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="label-tech mb-3 flex items-center gap-2 text-muted-foreground"
            >
              <span className="size-1.5 bg-brand" />
              {eyebrow}
            </motion.p>
          )}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
            className="font-heading text-4xl font-bold leading-[0.95] tracking-[-0.04em] md:text-5xl"
          >
            {title}
          </motion.h1>
          {description && (
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <Divider className="mt-6" />
    </header>
  )
}
