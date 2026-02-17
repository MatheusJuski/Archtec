import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react"; // Ícone de lixeira

interface Tag {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  tags: Tag[];
}

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
}

export function NoteCard({ note, onDelete }: NoteCardProps) {
  return (
    <Card className="flex flex-col justify-between hover:border-slate-500 transition-colors">
      <CardHeader>
        <CardTitle className="text-xl truncate">{note.title}</CardTitle>
        <div className="text-xs text-slate-400">
          {new Date(note.createdAt).toLocaleDateString()}
        </div>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm text-slate-300 line-clamp-3">
          {note.content}
        </p>
      </CardContent>

      <CardFooter className="flex justify-between items-end">
        <div className="flex flex-wrap gap-2">
          {note.tags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="text-xs">
              {tag.name}
            </Badge>
          ))}
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-red-500 hover:bg-red-950/20 hover:text-red-400"
          onClick={() => onDelete(note.id)}
        >
          <Trash2 size={18} />
        </Button>
      </CardFooter>
    </Card>
  );
}