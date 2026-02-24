import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NoteCard, Note } from "@/components/NoteCard";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { Editor } from "@/components/Editor";
import { useDebounce } from "@/hooks/use-debounce";
import { CheckCircle2, Cloud, Loader2, Plus, Trash2, LogOut } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const signOut = useAuthStore((state) => state.signOut);
  

  const navigate = useNavigate();
  const { id } = useParams();
  const activeNoteId = id || null;
  
  // Estado do Editor
  const [content, setContent] = useState(""); 
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debouncedContent = useDebounce(content, 1000);

  // Buscar notas ao carregar
  useEffect(() => {
    fetchNotes();
  }, []);

  async function fetchNotes() {
    try {
      const response = await api.get("/notes");
      setNotes(response.data);
    } catch (error) {
      toast.error("Erro ao carregar notas");
    }
  }

 
  useEffect(() => {
    if (activeNoteId && notes.length > 0) {
      const selectedNote = notes.find((n) => n.id === activeNoteId);
      if (selectedNote) {
        setContent(selectedNote.content || "");
      }
    } else if (!activeNoteId) {
      // Se não houver ID na URL (usuário está em /notes), esvazia o editor
      setContent("");
    }
    setSaveStatus("idle");
  }, [activeNoteId, notes]);

  // LÓGICA DE AUTO-SAVE
  useEffect(() => {
    // Evita salvar se estiver vazio ou se for a montagem inicial
    if (!debouncedContent || debouncedContent === "<p></p>") return;

    async function autoSaveNote() {
      setSaveStatus("saving");

      try {
        if (!activeNoteId) {
          // 1. Não tem ID na URL? Cria a nota (POST)
          const response = await api.post("/notes", {
            title: "Nova Nota Rápida",
            content: debouncedContent,
            tags: ["rascunho"],
          });
          
          navigate(`/notes/${response.data.id}`, { replace: true });
          
          // Precisamos atualizar a lista de notas para que a nova nota apareça na sidebar
          fetchNotes();
        } else {

          await api.patch(`/notes/${activeNoteId}`, {
            content: debouncedContent,
          });
          
          fetchNotes(); 
        }

        setSaveStatus("saved");

        // Volta para o ícone de nuvem após 2 segundos
        setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);

      } catch (error) {
        console.error("Erro no auto-save:", error);
        toast.error("Falha ao salvar automaticamente");
        setSaveStatus("idle");
      }
    }

    autoSaveNote();
  }, [debouncedContent]);


  function handleResetEditor() {
    navigate("/notes"); // Limpa a tela indo para a raiz das notas
  }
  
  function handleSelectNote(note: Note) {
    navigate(`/notes/${note.id}`); // Muda a URL para a nota selecionada
  }

  // Função para deletar nota
  async function handleDelete(id: string) {
    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      
      if (id === activeNoteId) {
        handleResetEditor(); // Se a nota deletada estava ativa, limpa a tela
      }
      
      toast.success("Nota removida!");
    } catch (error) {
      toast.error("Erro ao deletar nota");
    }
  }

 return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      
      <aside className="w-80 flex flex-col border-r border-border bg-[#05050f] shrink-0">
        
        {/* Cabeçalho da Sidebar */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-foreground">KNOWLEDGE</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleResetEditor} 
            title="Nova Nota"
          >
            <Plus size={18} />
          </Button>
        </div>

        {/* Lista rolável de notas */}
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
                  onClick={() => handleSelectNote(note)}
                  className={`
                    group flex flex-col gap-1 p-3 rounded-lg cursor-pointer transition-all border
                    ${isActive 
                      ? "bg-white/10 border-white/10 shadow-sm" 
                      : "bg-transparent border-transparent hover:bg-white/5"
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <h3 className={`font-sans font-medium text-sm truncate pr-2 ${isActive ? "text-foreground" : "text-slate-300"}`}>
                      {note.title || "Sem título"}
                    </h3>
                    
                    {/* Botão de deletar (aparece apenas no hover) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); 
                        handleDelete(note.id);
                      }}
                      className="text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground truncate font-sans">
                    {/* Remove as tags HTML do Tiptap para mostrar um preview limpo */}
                    {note.content ? note.content.replace(/<[^>]+>/g, '').substring(0, 40) + "..." : "Nota vazia"}
                  </p>
                </div>
              );
            })
          )}
        </div>
        </ScrollArea>
      </aside>


      <main className="flex-1 flex flex-col h-full bg-background overflow-y-auto p-8 lg:p-12">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          
          {/* Header do Editor */}
          <header className="flex items-center justify-between border-b border-border pb-4">
             <h1 className="text-2xl font-heading text-foreground">
               {activeNoteId ? "Editando Nota" : "Criar Nova Nota"}
             </h1>
             
             {/* Componente de Status de Salvamento e Logout */}
             <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 text-sm font-sans font-medium">
               {saveStatus === "idle" && (
                 <span className="flex items-center gap-1 text-muted-foreground"><Cloud size={16} /> Salvo</span>
               )}
               {saveStatus === "saving" && (
                 <span className="flex items-center gap-1 text-blue-400"><Loader2 size={16} className="animate-spin" /> Salvando...</span>
               )}
               {saveStatus === "saved" && (
                 <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 size={16} /> Salvo na nuvem</span>
               )}
               </div>

               <Button
                 variant="ghost"
                 size="sm"
                 onClick={() => {
                   signOut();
                   toast.success("Desconectado");
                   navigate("/login");
                 }}
                 title="Sair"
               >
                 <LogOut size={16} />
               </Button>
             </div>
          </header>

          <Editor content={content} onChange={setContent} />
          
        </div>
      </main>

    </div>
  );
}