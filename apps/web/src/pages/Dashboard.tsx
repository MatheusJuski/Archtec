import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NoteCard, Note } from "@/components/NoteCard";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";

export function Dashboard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const signOut = useAuthStore((state) => state.signOut);

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

  // Função para deletar nota
  async function handleDelete(id: string) {
    try {
      await api.delete(`/notes/${id}`);
      // Remove da lista localmente para não precisar recarregar tudo
      setNotes((prev) => prev.filter((n) => n.id !== id));
      toast.success("Nota removida!");
    } catch (error) {
      toast.error("Erro ao deletar nota");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-50">
      <header className="flex justify-between items-center mb-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold">Minhas Notas</h1>
        <Button variant="outline" onClick={signOut}>Sair</Button>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.length === 0 ? (
          <p className="text-slate-500 col-span-full text-center py-10">
            Nenhuma nota encontrada.
          </p>
        ) : (
          notes.map((note) => (
            <NoteCard key={note.id} note={note} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}