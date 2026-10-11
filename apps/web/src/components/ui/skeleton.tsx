import { cn } from "@/lib/utils"

/** Placeholder de carregamento com hachura em movimento. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("arch-skeleton", className)} {...props} />
}
