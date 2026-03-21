import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CalendarDays, FileText, ListChecks, Search } from "lucide-react"

import { api } from "@/lib/api"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

type SearchResultType = "note" | "task" | "event"

interface SearchResultItem {
  id: string
  type: SearchResultType
  title: string
  subtitle?: string
  url: string
}

const MIN_QUERY_LENGTH = 2

export function SearchAllCommand() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResultItem[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isHotkey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k"
      if (!isHotkey) return

      event.preventDefault()
      setOpen((prev) => !prev)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
      setLoading(false)
    }
  }, [open])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([])
      setLoading(false)
      return
    }

    const timeout = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await api.get<SearchResultItem[]>("/search", {
          params: { q: trimmed },
        })
        setResults(res.data)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 220)

    return () => window.clearTimeout(timeout)
  }, [query])

  const notes = useMemo(() => results.filter((item) => item.type === "note"), [results])
  const tasks = useMemo(() => results.filter((item) => item.type === "task"), [results])
  const events = useMemo(() => results.filter((item) => item.type === "event"), [results])

  function handleSelect(url: string) {
    setOpen(false)
    navigate(url)
  }

  function renderItem(item: SearchResultItem) {
    const icon =
      item.type === "note" ? (
        <FileText className="h-4 w-4 text-arcane" />
      ) : item.type === "task" ? (
        <ListChecks className="h-4 w-4 text-toxic" />
      ) : (
        <CalendarDays className="h-4 w-4 text-ember" />
      )

    return (
      <CommandItem key={`${item.type}:${item.id}`} value={`${item.type}-${item.title}-${item.subtitle || ""}`} onSelect={() => handleSelect(item.url)}>
        {icon}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
          {item.subtitle ? <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p> : null}
        </div>
      </CommandItem>
    )
  }

  const showTypedHint = query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-sm text-relic transition-colors hover:bg-muted/50 hover:text-arcane-glow"
        title="Busca global (Ctrl/Cmd+K)"
      >
        <Search className="h-4.5 w-4.5" />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar em notas, tarefas e eventos..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {showTypedHint ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Digite pelo menos 2 caracteres para buscar.
            </div>
          ) : null}

          <CommandEmpty>
            {loading ? "Buscando..." : "Nenhum resultado encontrado."}
          </CommandEmpty>

          {notes.length > 0 ? (
            <CommandGroup heading="Notas">
              {notes.map((item) => renderItem(item))}
            </CommandGroup>
          ) : null}

          {tasks.length > 0 ? (
            <>
              {notes.length > 0 ? <CommandSeparator /> : null}
              <CommandGroup heading="Tarefas">
                {tasks.map((item) => renderItem(item))}
              </CommandGroup>
            </>
          ) : null}

          {events.length > 0 ? (
            <>
              {notes.length > 0 || tasks.length > 0 ? <CommandSeparator /> : null}
              <CommandGroup heading="Eventos">
                {events.map((item) => renderItem(item))}
              </CommandGroup>
            </>
          ) : null}
        </CommandList>

        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>Atalho</span>
          <CommandShortcut>Ctrl/Cmd + K</CommandShortcut>
        </div>
      </CommandDialog>
    </>
  )
}
