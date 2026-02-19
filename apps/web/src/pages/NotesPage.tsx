import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NoteCard, Note } from "@/components/NoteCard";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { Editor } from "@/components/Editor";

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const signOut = useAuthStore((state) => state.signOut);
  
  // Estado do Editor e Loading
  const [content, setContent] = useState(""); 
  const [isCreating, setIsCreating] = useState(false);

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

  // Função para criar nota (Conectada ao Backend)
  async function handleCreateNote() {
    // Validação simples para não enviar vazio
    if (!content || content === "<p></p>") {
      toast.warning("Escreva algo antes de salvar!");
      return;
    }

    setIsCreating(true);

    try {
      // Envia para a API (ajuste os campos conforme seu Backend espera)
      await api.post("/notes", {
        title: "Nova Nota Rápida", // Como não temos input de título, usamos um padrão por enquanto
        content: content,
        tags: ["rascunho"], // Tag padrão
      });

      toast.success("Nota salva com sucesso!");
      setContent(""); // Limpa o editor visualmente
      fetchNotes();   // Recarrega a lista para mostrar a nova nota
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar nota");
    } finally {
      setIsCreating(false);
    }
  }

  // Função para deletar nota
  async function handleDelete(id: string) {
    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      toast.success("Nota removida!");
    } catch (error) {
      toast.error("Erro ao deletar nota");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-50">
      
      {/* HEADER */}
      <header className="flex justify-between items-center mb-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
           <span className="text-2xl"></span>
           <h1 className="text-3xl font-bold">Minhas Notas</h1>
        </div>
        <Button variant="outline" onClick={signOut} className="border-slate-700 hover:bg-slate-800">
          Sair
        </Button>
      </header>

      {/* ÁREA DE CRIAÇÃO (EDITOR) */}
      <div className="max-w-6xl mx-auto mb-12 space-y-4">
        <h2 className="text-xl font-semibold text-slate-200 ml-1">Criar Nova Nota</h2>
        
        {/* O Wrapper do Editor + Botão de Ação */}
        <div className="flex flex-col gap-4">
          <Editor 
            content={content} 
            onChange={setContent} 
          />
          
          <div className="flex justify-end">
            <Button 
              onClick={handleCreateNote} 
              disabled={isCreating || !content || content === "<p></p>"}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-30"
            >
              {isCreating ? "Salvando..." : "Salvar Nota"}
            </Button>
          </div>
        </div>
      </div>

      {/* LISTAGEM DE CARDS */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500 border-2 border-dashed border-slate-800 rounded-lg">
            <p className="text-lg">Sua área de trabalho está vazia.</p>
            <p className="text-sm">Use o editor acima para criar sua primeira nota.</p>
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