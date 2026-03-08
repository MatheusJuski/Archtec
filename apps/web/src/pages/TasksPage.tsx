import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { Task, TaskList, TaskCallbacks } from "@/components/TaskItem";
import { Loader2, LogOut, Plus, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";



function findInTree(
  tasks: Task[],
  id: string,
  parent: Task | null = null,
): { task: Task; parent: Task | null; siblings: Task[] } | null {
  for (const t of tasks) {
    if (t.id === id) return { task: t, parent, siblings: tasks };
    if (t.children) {
      const found = findInTree(t.children, id, t);
      if (found) return found;
    }
  }
  return null;
}

function removeFromTree(tasks: Task[], id: string): Task[] {
  return tasks
    .filter((t) => t.id !== id)
    .map((t) => ({
      ...t,
      children: t.children ? removeFromTree(t.children, id) : [],
    }));
}

function addChildToTask(tasks: Task[], targetId: string, child: Task): Task[] {
  return tasks.map((t) => {
    if (t.id === targetId) {
      return { ...t, children: [...(t.children ?? []), child] };
    }
    return {
      ...t,
      children: t.children ? addChildToTask(t.children, targetId, child) : [],
    };
  });
}

function insertAfterInTree(tasks: Task[], targetId: string, item: Task): Task[] {
  const result: Task[] = [];
  for (const t of tasks) {
    result.push({
      ...t,
      children: t.children ? insertAfterInTree(t.children, targetId, item) : [],
    });
    if (t.id === targetId) {
      result.push(item);
    }
  }
  return result;
}

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const signOut = useAuthStore((state) => state.signOut);
  const { theme, toggleTheme } = useThemeStore();

  useEffect(() => {
    api
      .get("/tasks", { params: { tree: "true" } })
      .then((res) => setTasks(res.data))
      .catch(() => toast.error("Erro ao carregar tarefas"))
      .finally(() => setLoading(false));
  }, []);

  // ── Criar tarefa ──
  const handleCreate = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const res = await api.post("/tasks", { title });
      const created: Task = { ...res.data, children: [] };
      setTasks((prev) => [...prev, created]);
      setNewTitle("");
      inputRef.current?.focus();
    } catch {
      toast.error("Erro ao criar tarefa");
    } finally {
      setCreating(false);
    }
  }, [newTitle]);

  // ── INDENT ──
  const handleIndent = useCallback((taskId: string) => {
    setTasks((prev) => {
      const found = findInTree(prev, taskId);
      if (!found) return prev;
      const { task, siblings } = found;
      const idx = siblings.findIndex((t) => t.id === taskId);
      if (idx <= 0) return prev;

      const newParentId = siblings[idx - 1].id;
      const movedTask: Task = { ...task, parentId: newParentId, children: task.children ?? [] };
      let tree = removeFromTree(prev, taskId);
      tree = addChildToTask(tree, newParentId, movedTask);

      api.patch(`/tasks/${taskId}/move`, { parentId: newParentId }).catch(() => {
        toast.error("Erro ao mover tarefa");
        api.get("/tasks", { params: { tree: "true" } }).then((res) => setTasks(res.data));
      });
      return tree;
    });
  }, []);

  // ── OUTDENT ──
  const handleOutdent = useCallback((taskId: string) => {
    setTasks((prev) => {
      const found = findInTree(prev, taskId);
      if (!found || !found.parent) return prev;
      const { task, parent } = found;
      const grandparentId = parent.parentId;
      const movedTask: Task = { ...task, parentId: grandparentId, children: task.children ?? [] };

      let tree = removeFromTree(prev, taskId);
      tree = insertAfterInTree(tree, parent.id, movedTask);

      api.patch(`/tasks/${taskId}/move`, { parentId: grandparentId }).catch(() => {
        toast.error("Erro ao mover tarefa");
        api.get("/tasks", { params: { tree: "true" } }).then((res) => setTasks(res.data));
      });
      return tree;
    });
  }, []);

  const callbacks: TaskCallbacks = {
    onIndent: handleIndent,
    onOutdent: handleOutdent,
  };

  return (
    <div className="mx-auto flex h-screen max-w-4xl flex-col gap-6 p-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Ornamento decorativo */}
          <div className="h-8 w-1 rounded-full bg-linear-to-b from-arcane to-arcane/20" />
          <h1 className="font-heading text-2xl font-bold tracking-wider text-foreground">
            Tarefas
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-relic hover:text-arcane hover:bg-muted/50"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="text-relic hover:text-ember hover:bg-muted/50"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ═══ Input de nova tarefa ═══ */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Nova tarefa..."
            className="
              w-full rounded-sm border border-border bg-card px-4 py-2.5
              text-sm text-foreground placeholder:text-muted-foreground
              focus:outline-none focus:ring-1 focus:ring-arcane/50 focus:border-arcane/50
              transition-all
            "
            disabled={creating}
          />
          {/* Linha decorativa inferior */}
          <div className="absolute bottom-0 left-4 right-4 h-px bg-linear-to-r from-transparent via-arcane/20 to-transparent" />
        </div>
        <Button
          onClick={handleCreate}
          disabled={creating || !newTitle.trim()}
          className="
            bg-arcane text-primary-foreground hover:bg-arcane-glow
            disabled:opacity-40 rounded-sm px-4 h-10
            transition-all
          "
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* ═══ Separador ornamental ═══ */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-linear-to-r from-transparent via-border to-transparent" />
        <span className="text-[10px] font-heading tracking-[0.3em] text-relic uppercase">
          Hierarquia
        </span>
        <div className="flex-1 h-px bg-linear-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ═══ Conteúdo ═══ */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-arcane" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="h-16 w-16 rounded-full border border-ash flex items-center justify-center">
            <Plus className="h-6 w-6 text-relic" />
          </div>
          <p className="text-sm">Nenhuma tarefa encontrada.</p>
          <p className="text-xs text-relic">Crie sua primeira tarefa acima</p>
        </div>
      ) : (
        <div className="
          rounded-sm border border-border bg-card/50 p-3
          shadow-[inset_0_1px_0_rgba(201,168,76,0.05)]
          overflow-y-auto flex-1
        ">
          <TaskList tasks={tasks} callbacks={callbacks} />
        </div>
      )}
    </div>
  );
}
