import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NoteCard, Note } from "@/components/NoteCard";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { Editor } from "@/components/Editor";
import { useDebounce } from "@/hooks/use-debounce";
import { CheckCircle2, Cloud, Loader2, Plus } from "lucide-react";

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const signOut = useAuthStore((state) => state.signOut);
  
  // Estado do Editor
  const [content, setContent] = useState(""); 
  
  // NOVOS ESTADOS PARA AUTO-SAVE
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  
  // A Mágica do Debounce: 1000ms
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

  // LÓGICA DE AUTO-SAVE
  useEffect(() => {
    // Evita salvar se estiver vazio ou se for a montagem inicial
    if (!debouncedContent || debouncedContent === "<p></p>") return;

    async function autoSaveNote() {
      setSaveStatus("saving");

      try {
        if (!activeNoteId) {
          // 1. Não tem ID? Cria a nota (POST)
          const response = await api.post("/notes", {
            title: "Nova Nota Rápida",
            content: debouncedContent,
            tags: ["rascunho"],
          });
          
          // Salva o ID retornado pelo backend para as próximas edições
          setActiveNoteId(response.data.id); 
        } else {
          // 2. Já tem ID? Apenas atualiza (PATCH)
          await api.patch(`/notes/${activeNoteId}`, {
            content: debouncedContent,
          });
        }

        setSaveStatus("saved");
        fetchNotes(); // Atualiza a grid de notas silenciosamente

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
  }, [debouncedContent]); // Executa sempre que o debounce terminar

  // Função para limpar o editor e criar uma nota do zero
  function handleResetEditor() {
    setContent("");
    setActiveNoteId(null);
    setSaveStatus("idle");
  }

  // Função para deletar nota
  async function handleDelete(id: string) {
    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      
      if (id === activeNoteId) {
        handleResetEditor();
      }
      
      toast.success("Nota removida!");
    } catch (error) {
      toast.error("Erro ao deletar nota");
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      
      {/* HEADER */}
      <header className="flex justify-between items-center mb-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
           <h1 className="text-3xl font-heading text-foreground">Minhas Notas</h1>
        </div>
        <Button variant="outline" onClick={signOut} className="border-border hover:bg-white/5 text-foreground">
          Sair
        </Button>
      </header>

      {/* ÁREA DE CRIAÇÃO (EDITOR) */}
      <div className="max-w-6xl mx-auto mb-12 space-y-4">
        
        <div className="flex items-center justify-between ml-1 mb-2">
           <h2 className="text-xl font-heading text-foreground">
             {activeNoteId ? "Editando Nota" : "Criar Nova Nota"}
           </h2>
           
           {/* FEEDBACK DE AUTO-SAVE */}
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-sm font-sans font-medium">
               {saveStatus === "idle" && (
                 <span className="flex items-center gap-1.5 text-muted-foreground">
                   <Cloud size={16} /> Salvo localmente
                 </span>
               )}
               {saveStatus === "saving" && (
                 <span className="flex items-center gap-1.5 text-blue-400">
                   <Loader2 size={16} className="animate-spin" /> Salvando...
                 </span>
               )}
               {saveStatus === "saved" && (
                 <span className="flex items-center gap-1.5 text-emerald-400">
                   <CheckCircle2 size={16} /> Salvo na nuvem
                 </span>
               )}
             </div>

             {/* Botão para limpar e começar uma nova nota */}
             {activeNoteId && (
               <Button 
                 variant="ghost" 
                 size="sm" 
                 onClick={handleResetEditor}
                 className="text-muted-foreground hover:text-foreground"
               >
                 <Plus size={16} className="mr-1" /> Nova
               </Button>
             )}
           </div>
        </div>
        
        <div className="flex flex-col gap-4">
          <Editor 
            content={content} 
            onChange={setContent} 
          />
        </div>
      </div>

      {/* LISTAGEM DE CARDS */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-lg">
            <p className="text-lg font-heading">Sua área de trabalho está vazia.</p>
            <p className="text-sm font-sans">Use o editor acima para criar sua primeira nota.</p>
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard key={note.id} note={note} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}