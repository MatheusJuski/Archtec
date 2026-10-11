import { Toaster as Sonner } from "sonner"
import { useThemeStore } from "@/store/theme"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useThemeStore((state) => state.theme)

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-none group-[.toaster]:!border group-[.toaster]:!border-ink group-[.toaster]:!shadow-[4px_4px_0_0_var(--ink)] group-[.toaster]:font-sans",
          title: "font-medium",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "!rounded-none group-[.toast]:!bg-ink group-[.toast]:!text-surface-1",
          cancelButton:
            "!rounded-none group-[.toast]:!bg-muted group-[.toast]:!text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
