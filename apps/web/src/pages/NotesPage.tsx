import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Editor } from "@/components/Editor";
import { useDebounce } from "@/hooks/use-debounce";
import { FileText, PanelLeftClose, PanelLeftOpen, Plus, Trash2, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Divider } from "@/components/ui/divider";
import { cn } from "@/lib/utils";

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

const saveLabels = {
  idle: { text: "Salvo localmente", dot: "bg-ink-muted" },
  saving: { text: "Salvando…", dot: "bg-signal arch-pulse" },
  saved: { text: "Salvo na nuvem", dot: "bg-success" },
} as const;

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export interface NoteData {
  id: string;
  title: string;
  content: string;
  tags?: any[];
}

export function NotesPage() {
  const [notes, setNotes] = useState<NoteData[]>([]);
  
  const navigate = useNavigate();
  const { id } = useParams();
  const activeNoteId = id || null;
  
  const [loadedNoteId, setLoadedNoteId] = useState<string | null>(null);

  // Estados do Editor
  const [title, setTitle] = useState("");
  const [content, setContent] = useState(""); 
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [listOpen, setListOpen] = useState(isDesktop);

  const debouncedTitle = useDebounce(title, 1000);
  const debouncedContent = useDebounce(content, 1000);
  const debouncedTags = useDebounce(tags, 1000);

  // 1. REFS: Para acessar os dados mais recentes sem engatilhar re-renderizações infinitas
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  const tagsRef = useRef(tags);
  useEffect(() => {
    titleRef.current = title;
    contentRef.current = content;
    tagsRef.current = tags;
  }, [title, content, tags]);

  // 2. CARREGAMENTO INICIAL
  useEffect(() => {
    api.get("/notes")
       .then(response => setNotes(response.data))
       .catch(() => toast.error("Erro ao carregar notas"));
  }, []);

  const activeNote = useMemo(() => {
    return notes.find((n) => n.id === activeNoteId) || null;
  }, [notes, activeNoteId]);

  // 3. SINCRONIZADOR & SALVAMENTO DE EMERGÊNCIA (O coração da solução)
  useEffect(() => {
    // Só entra aqui se a URL mudou e a nova nota ainda não foi carregada no editor
    if (loadedNoteId !== activeNoteId) {
      

      if (loadedNoteId !== null) {
         const oldNote = notes.find(n => n.id === loadedNoteId);
         if (oldNote) {
          const latestTitle = titleRef.current;
            const latestContent = contentRef.current;
            const latestTags = tagsRef.current;
            const oldTags = oldNote.tags?.map(t => typeof t === 'string' ? t : t.name) || [];

            // Se algo foi alterado, despacha pro banco em background
          if (
            oldNote.title !== latestTitle ||
            oldNote.content !== latestContent ||
            JSON.stringify(oldTags) !== JSON.stringify(latestTags)
          ) {
            api.patch(`/notes/${loadedNoteId}`, {
             title: latestTitle.trim() || "Nova Nota",
             content: latestContent,
             tags: latestTags,
            }).catch(() => {});
               // Mantém a lista atualizada
            setNotes(prev => prev.map(n => n.id === loadedNoteId ? {
             ...n,
             title: latestTitle.trim() || "Nova Nota",
             content: latestContent,
             tags: latestTags,
            } : n));
            }
         }
      }


      if (activeNoteId && notes.length > 0) {
         const selectedNote = notes.find((n) => n.id === activeNoteId);
         if (selectedNote) {
          setTitle(selectedNote.title || "");
            setContent(selectedNote.content || "");
            setTags(selectedNote.tags?.map(t => typeof t === 'string' ? t : t.name) || []);
            setLoadedNoteId(activeNoteId);
         }
      } else if (!activeNoteId) {
        setTitle("");
         setContent("");
         setTags([]);
         setLoadedNoteId(null);
      }
    }
  }, [activeNoteId, notes, loadedNoteId]);

  // 4. HANDLERS (Otimizados)
  const handleKeyDownTag = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (newTag && !tags.includes(newTag)) {
        setTags(prev => [...prev, newTag]);
      }
      setTagInput("");
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  }, []);

  // 5. AUTO-SAVE 
  useEffect(() => {

    if (loadedNoteId !== activeNoteId) return;
    

    if (title !== debouncedTitle || content !== debouncedContent || tags !== debouncedTags) return;

    if (
      !activeNoteId &&
      (!debouncedTitle.trim()) &&
      (!debouncedContent || debouncedContent === "<p></p>") &&
      debouncedTags.length === 0
    ) return;

    if (activeNote) {
      const titleUnchanged = debouncedTitle === (activeNote.title || "");
      const contentUnchanged = debouncedContent === (activeNote.content || "");
      const loadedTags = activeNote.tags ? activeNote.tags.map(t => typeof t === 'string' ? t : t.name) : [];
      const tagsUnchanged = debouncedTags.length === loadedTags.length && debouncedTags.every((val, index) => val === loadedTags[index]);
      
      if (titleUnchanged && contentUnchanged && tagsUnchanged) return;
    }

    async function autoSaveNote() {
      setSaveStatus("saving");

      const payload = {
        title: debouncedTitle.trim() || "Nova Nota",
        content: debouncedContent,
        tags: debouncedTags,
      };

      try {
        if (!activeNoteId) {
          const response = await api.post("/notes", payload);
          setNotes(prev => [response.data, ...prev]);
          navigate(`/notes/${response.data.id}`, { replace: true });
        } else {
          await api.patch(`/notes/${activeNoteId}`, payload);
          setNotes(prev => prev.map(note => 
            note.id === activeNoteId ? { ...note, title: payload.title, content: payload.content, tags: payload.tags } : note
          ));
        }

        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) {
        toast.error("Falha ao salvar");
        setSaveStatus("idle");
      }
    }

    autoSaveNote();
  }, [debouncedTitle, debouncedContent, debouncedTags, activeNoteId, activeNote, loadedNoteId, title, content, tags, navigate]); 

  // 6. NAVEGAÇÃO E EXCLUSÃO
  const handleResetEditor = useCallback(() => navigate("/notes"), [navigate]);
  const handleSelectNote = useCallback((id: string) => {
    navigate(`/notes/${id}`);
    if (!isDesktop()) setListOpen(false);
  }, [navigate]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (id === activeNoteId) handleResetEditor();
      toast.success("Nota removida!");
    } catch (error) {
      toast.error("Erro ao deletar nota");
    }
  }, [activeNoteId, handleResetEditor]);

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      {/* Fundo escurecido do drawer (mobile) */}
      <AnimatePresence>
        {listOpen && (
          <motion.button
            aria-label="Fechar lista de notas"
            className="fixed inset-0 z-30 bg-surface-1/70 backdrop-blur-[2px] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setListOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* SIDEBAR */}
      <aside
        className={cn(
          "z-40 flex w-72 shrink-0 flex-col border-r border-ink bg-card transition-[margin,transform] duration-300 ease-[var(--ease-snap)]",
          "fixed inset-y-0 left-0 md:static",
          listOpen ? "translate-x-0 md:ml-0" : "-translate-x-full md:-ml-72 md:translate-x-0",
        )}
      >
        <div className="border-b border-ink p-4">
          <div className="flex items-center justify-between">
            <p className="label-tech flex items-center gap-2 text-muted-foreground">
              <span className="size-1.5 bg-brand" /> 02 / Notas
            </p>
            <span className="label-tech tabular-nums text-muted-foreground">{String(notes.length).padStart(2, "0")}</span>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <h2 className="font-heading text-3xl font-bold leading-none tracking-[-0.04em]">Notas</h2>
            <Button variant="outline" size="icon" onClick={handleResetEditor} aria-label="Nova nota" className="h-8 w-8">
              <Plus />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {notes.length === 0 ? (
              <div className="hatch m-2 flex flex-col items-center gap-2 border border-dashed border-line px-4 py-10 text-center">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <p className="label-tech text-muted-foreground">Nenhuma nota ainda</p>
              </div>
            ) : (
              notes.map((note) => {
                const isActive = note.id === activeNoteId;
                const preview = note.content ? stripHtml(note.content) : "";
                return (
                  <motion.div
                    layout="position"
                    key={note.id}
                    onClick={() => handleSelectNote(note.id)}
                    className={cn(
                      "group relative flex cursor-pointer flex-col gap-1 border py-2.5 pl-4 pr-3 transition-[background-color,border-color,transform] duration-150",
                      isActive
                        ? "border-ink bg-background"
                        : "border-transparent hover:translate-x-0.5 hover:border-line hover:bg-background/60",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 left-0 w-0.75 origin-top bg-brand transition-transform duration-200",
                        isActive ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100",
                      )}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={cn("truncate font-sans text-sm font-medium tracking-normal", isActive ? "text-foreground" : "text-foreground/85")}>
                        {note.title?.trim() || "Sem título"}
                      </h3>
                      <button
                        onClick={(e) => handleDelete(note.id, e)}
                        aria-label="Excluir nota"
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <p className="truncate text-xs text-muted-foreground">
                      {preview ? preview.substring(0, 60) : "Nota vazia"}
                    </p>

                    {note.tags && note.tags.length > 0 && (
                      <div className="mt-1 flex gap-1 overflow-hidden">
                        {note.tags.slice(0, 3).map((t, idx) => (
                          <span key={idx} className="border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            #{typeof t === "string" ? t : t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* ÁREA DO EDITOR */}
      <section className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-background/85 px-4 py-2.5 backdrop-blur md:px-8">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setListOpen((v) => !v)}
              aria-label={listOpen ? "Ocultar lista" : "Mostrar lista"}
            >
              {listOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
            <span className="label-tech text-muted-foreground">
              {activeNoteId ? "Editando nota" : "Nova nota"}
            </span>
          </div>

          <div className="flex items-center gap-2" aria-live="polite">
            <span className={cn("size-2", saveLabels[saveStatus].dot)} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={saveStatus}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="label-tech text-muted-foreground"
              >
                {saveLabels[saveStatus].text}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl space-y-6 px-5 py-8 md:px-10 md:py-12">
          <header className="space-y-4">
            <textarea
              rows={1}
              value={title}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
              placeholder="Título da nota"
              className="field-sizing-content w-full resize-none bg-transparent font-heading text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-foreground outline-none placeholder:text-muted-foreground/50 md:text-5xl"
            />

            {/* INPUT DE TAGS */}
            <div className="flex flex-wrap items-center gap-2">
              {tags.map((tag) => (
                <motion.span
                  key={tag}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="chip gap-1.5 normal-case tracking-normal"
                >
                  #{tag}
                  <button onClick={() => handleRemoveTag(tag)} aria-label={`Remover tag ${tag}`} className="opacity-60 transition-opacity hover:opacity-100">
                    <X size={12} />
                  </button>
                </motion.span>
              ))}

              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDownTag}
                placeholder={tags.length === 0 ? "+ Adicionar tag (Enter)" : "+ tag"}
                className="h-7 min-w-37.5 flex-1 bg-transparent font-mono text-xs text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
            </div>
          </header>

          <Divider />

          <Editor content={content} onChange={setContent} />
        </div>
      </section>
    </div>
  );
}
