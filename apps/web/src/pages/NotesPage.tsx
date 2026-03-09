import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Editor } from "@/components/Editor";
import { useDebounce } from "@/hooks/use-debounce";
import { CheckCircle2, Cloud, Loader2, Plus, Trash2, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [content, setContent] = useState(""); 
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const debouncedContent = useDebounce(content, 1000);
  const debouncedTags = useDebounce(tags, 1000);

  // 1. REFS: Para acessar os dados mais recentes sem engatilhar re-renderizações infinitas
  const contentRef = useRef(content);
  const tagsRef = useRef(tags);
  useEffect(() => {
    contentRef.current = content;
    tagsRef.current = tags;
  }, [content, tags]);

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
            const latestContent = contentRef.current;
            const latestTags = tagsRef.current;
            const oldTags = oldNote.tags?.map(t => typeof t === 'string' ? t : t.name) || [];

            // Se algo foi alterado, despacha pro banco em background
            if (oldNote.content !== latestContent || JSON.stringify(oldTags) !== JSON.stringify(latestTags)) {
               api.patch(`/notes/${loadedNoteId}`, { content: latestContent, tags: latestTags }).catch(() => {});
               // Mantém a lista atualizada
               setNotes(prev => prev.map(n => n.id === loadedNoteId ? { ...n, content: latestContent, tags: latestTags } : n));
            }
         }
      }


      if (activeNoteId && notes.length > 0) {
         const selectedNote = notes.find((n) => n.id === activeNoteId);
         if (selectedNote) {
            setContent(selectedNote.content || "");
            setTags(selectedNote.tags?.map(t => typeof t === 'string' ? t : t.name) || []);
            setLoadedNoteId(activeNoteId);
         }
      } else if (!activeNoteId) {
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
    

    if (content !== debouncedContent || tags !== debouncedTags) return;

    if (!activeNoteId && (!debouncedContent || debouncedContent === "<p></p>") && debouncedTags.length === 0) return;

    if (activeNote) {
      const contentUnchanged = debouncedContent === (activeNote.content || "");
      const loadedTags = activeNote.tags ? activeNote.tags.map(t => typeof t === 'string' ? t : t.name) : [];
      const tagsUnchanged = debouncedTags.length === loadedTags.length && debouncedTags.every((val, index) => val === loadedTags[index]);
      
      if (contentUnchanged && tagsUnchanged) return;
    }

    async function autoSaveNote() {
      setSaveStatus("saving");

      const payload = {
        title: "Nova Nota",
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
            note.id === activeNoteId ? { ...note, content: payload.content, tags: payload.tags } : note
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
  }, [debouncedContent, debouncedTags, activeNoteId, activeNote, loadedNoteId, content, tags, navigate]); 

  // 6. NAVEGAÇÃO E EXCLUSÃO
  const handleResetEditor = useCallback(() => navigate("/notes"), [navigate]);
  const handleSelectNote = useCallback((id: string) => navigate(`/notes/${id}`), [navigate]);

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
    <div className="flex h-screen w-full bg-background overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-72 flex flex-col border-r border-border bg-card/50 shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-0.5 rounded-full bg-linear-to-b from-arcane to-arcane/20" />
            <h2 className="font-heading text-lg font-bold text-foreground">Notas</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={handleResetEditor} title="Nova Nota" className="text-relic hover:text-arcane hover:bg-muted/50">
            <Plus size={18} />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {notes.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Vazio.</p>
            ) : (
              notes.map((note) => {
                const isActive = note.id === activeNoteId;
                return (
                  <div
                    key={note.id}
                    onClick={() => handleSelectNote(note.id)}
                    className={`
                      group flex flex-col gap-1 p-3 rounded-sm cursor-pointer transition-all border
                      ${isActive ? "bg-arcane/10 border-arcane/20 shadow-[0_0_8px_rgba(201,168,76,0.08)]" : "bg-transparent border-transparent hover:bg-muted/40"}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className={`font-sans font-medium text-sm truncate pr-2 ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {note.title || "Sem título"}
                      </h3>
                      <button
                        onClick={(e) => handleDelete(note.id, e)}
                        className="text-muted-foreground hover:text-ember opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    
                    <p className="text-xs text-relic truncate font-sans mb-1">
                      {note.content ? note.content.replace(/<[^>]+>/g, '').substring(0, 40) + "..." : "Nota vazia"}
                    </p>

                    {/* MINIATURA DE TAGS */}
                    {note.tags && note.tags.length > 0 && (
                       <div className="flex gap-1 overflow-hidden">
                         {note.tags.slice(0, 3).map((t, idx) => (
                           <span key={idx} className="text-[10px] bg-arcane/10 text-relic px-1.5 py-0.5 rounded-sm">
                             #{typeof t === 'string' ? t : t.name}
                           </span>
                         ))}
                       </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* ÁREA DO EDITOR */}
      <main className="flex-1 flex flex-col h-full bg-background overflow-y-auto p-8 lg:p-12">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          
          <header className="flex flex-col gap-4 border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-heading text-foreground">
                {activeNoteId ? "Editando Nota" : "Criar Nova Nota"}
              </h1>
              
              <div className="flex items-center gap-2 text-sm font-sans font-medium">
                {saveStatus === "idle" && <span className="flex items-center gap-1 text-relic"><Cloud size={16} /> Salvo localmente</span>}
                {saveStatus === "saving" && <span className="flex items-center gap-1 text-arcane"><Loader2 size={16} className="animate-spin" /> Salvando...</span>}
                {saveStatus === "saved" && <span className="flex items-center gap-1 text-toxic"><CheckCircle2 size={16} /> Salvo na nuvem</span>}
              </div>
            </div>

            {/* INPUT DE TAGS */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {tags.map(tag => (
                <span 
                  key={tag} 
                  className="flex items-center gap-1.5 bg-arcane/10 border border-arcane/20 text-arcane px-2.5 py-1 rounded-sm text-xs font-sans font-medium"
                >
                  #{tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:text-ember transition-colors">
                    <X size={12} />
                  </button>
                </span>
              ))}
              
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDownTag}
                placeholder={tags.length === 0 ? "Adicionar tag (Aperte Enter)..." : "Nova tag..."}
                className="bg-transparent border-none text-sm text-muted-foreground focus:outline-none focus:ring-0 flex-1 min-w-37.5 font-sans h-8"
              />
            </div>
          </header>

          <Editor content={content} onChange={setContent} />
          
        </div>
      </main>

    </div>
  );
}