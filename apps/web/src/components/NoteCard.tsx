import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export interface Tag {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  // MUDANÇA 1: Aceitar nomes comuns de data de backend
  date?: string; 
  createdAt?: string; 
  tags: (Tag | string)[]; 
}

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
}

export function NoteCard({ note, onDelete }: NoteCardProps) {
  // MUDANÇA 2: Função segura para pegar a data correta
  const displayDate = note.date || note.createdAt || new Date().toISOString();

  return (
    <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-6 shadow-sm transition-all hover:border-slate-700 hover:shadow-md h-full">
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="font-semibold leading-none tracking-tight text-slate-100">
            {note.title}
          </h3>
          <p className="text-xs text-slate-500">
            {/* MUDANÇA 3: Tratamento de erro na data */}
            {new Date(displayDate).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })}
          </p>
        </div>

        <div 
          className="prose prose-invert prose-sm text-slate-400 line-clamp-6 [&>*:first-child]:mt-0"
          dangerouslySetInnerHTML={{ __html: note.content }}
        />
        
        {note.tags && note.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
              {note.tags.map((tag: any, index) => {
                  const tagName = typeof tag === 'string' ? tag : tag.name;
                  const tagKey = typeof tag === 'string' ? index : tag.id;
                  
                  return (
                    <span key={tagKey} className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">
                      #{tagName}
                    </span>
                  )
              })}
          </div>
        )}
      </div>

      <div className="flex justify-end mt-4 pt-4 border-t border-slate-800/50">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-slate-500 hover:text-red-400 hover:bg-red-950/20"
          onClick={() => onDelete(note.id)}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Deletar</span>
        </Button>
      </div>
    </div>
  );
}