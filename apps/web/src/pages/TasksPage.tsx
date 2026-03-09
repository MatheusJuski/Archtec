import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import {
  Task,
  TaskList,
  TaskCallbacks,
  flattenTaskIds,
} from "@/components/TaskItem";
import { Loader2, LogOut, Plus, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

// ── Helpers para manipular a árvore imutavelmente ──

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

/** Insere uma task em uma posição específica dentro dos irmãos de um parentId */
function insertAtPosition(
  tasks: Task[],
  parentId: string | null,
  item: Task,
  index: number,
): Task[] {
  if (parentId === null) {
    // Inserir no nível root
    const result = [...tasks];
    result.splice(Math.min(index, result.length), 0, item);
    return result;
  }
  return tasks.map((t) => {
    if (t.id === parentId) {
      const children = [...(t.children ?? [])];
      children.splice(Math.min(index, children.length), 0, item);
      return { ...t, children };
    }
    return {
      ...t,
      children: t.children ? insertAtPosition(t.children, parentId, item, index) : [],
    };
  });
}

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const signOut = useAuthStore((state) => state.signOut);
  const { theme, toggleTheme } = useThemeStore();

  // Para DnD: precisamos de todos os IDs expandidos
  // por simplicidade, consideramos tudo expandido (o estado de expand está no TaskItem)
  const allExpanded = useMemo(() => {
    const set = new Set<string>();
    function walk(items: Task[]) {
      for (const t of items) {
        set.add(t.id);
        if (t.children?.length) walk(t.children);
      }
    }
    walk(tasks);
    return set;
  }, [tasks]);

  const flatIds = useMemo(
    () => flattenTaskIds(tasks, allExpanded),
    [tasks, allExpanded],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  useEffect(() => {
    api
      .get("/tasks", { params: { tree: "true" } })
      .then((res) => setTasks(res.data))
      .catch(() => toast.error("Erro ao carregar tarefas"))
      .finally(() => setLoading(false));
  }, []);

  const reloadTree = useCallback(() => {
    api.get("/tasks", { params: { tree: "true" } }).then((res) => setTasks(res.data));
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

      const newSiblingCount = (findInTree(tree, newParentId)?.task.children?.length ?? 1) - 1;
      api.patch(`/tasks/${taskId}/move`, { parentId: newParentId, order: newSiblingCount }).catch(() => {
        toast.error("Erro ao mover tarefa");
        reloadTree();
      });
      return tree;
    });
  }, [reloadTree]);

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

      // Calcular a posição do pai nos seus irmãos + 1
      const parentFound = findInTree(tree, parent.id);
      const parentIdx = parentFound ? parentFound.siblings.findIndex((t) => t.id === parent.id) : 0;
      // O item inserido logo após o pai fica em parentIdx + 1 (0-based), mas como já inserimos, basta informar
      api.patch(`/tasks/${taskId}/move`, { parentId: grandparentId, order: parentIdx + 1 }).catch(() => {
        toast.error("Erro ao mover tarefa");
        reloadTree();
      });
      return tree;
    });
  }, [reloadTree]);

  // ── TOGGLE COMPLETE ──
  const handleToggleComplete = useCallback((taskId: string) => {
    api
      .patch(`/tasks/${taskId}/toggle`)
      .then((res) => setTasks(res.data))
      .catch(() => toast.error("Erro ao atualizar status"));
  }, []);

  // ── DRAG & DROP ──
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedId = active.id as string;
    const overId = over.id as string;

    setTasks((prev) => {
      const draggedFound = findInTree(prev, draggedId);
      const overFound = findInTree(prev, overId);
      if (!draggedFound || !overFound) return prev;

      const draggedTask = draggedFound.task;

      // O destino: mesma lista do over (mesmo parent)
      const newParentId = overFound.task.parentId;
      const overIndex = overFound.siblings.findIndex((t) => t.id === overId);

      // 1. Remover da posição antiga
      let tree = removeFromTree(prev, draggedId);

      // 2. Inserir na posição do over
      const movedTask: Task = { ...draggedTask, parentId: newParentId, children: draggedTask.children ?? [] };
      tree = insertAtPosition(tree, newParentId, movedTask, overIndex);

      // 3. Persistir no backend
      api.patch(`/tasks/${draggedId}/move`, { parentId: newParentId, order: overIndex }).catch(() => {
        toast.error("Erro ao reordenar tarefa");
        reloadTree();
      });

      return tree;
    });
  }, [reloadTree]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const callbacks: TaskCallbacks = {
    onIndent: handleIndent,
    onOutdent: handleOutdent,
    onToggleComplete: handleToggleComplete,
  };

  // Encontra a task sendo arrastada para o overlay
  const activeTask = activeId ? (() => {
    const found = findInTree(tasks, activeId);
    return found?.task ?? null;
  })() : null;

  return (
    <div className="mx-auto flex h-screen max-w-4xl flex-col gap-6 p-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
            <div className="
              rounded-sm border border-border bg-card/50 p-3
              shadow-[inset_0_1px_0_rgba(201,168,76,0.05)]
              overflow-y-auto flex-1
            ">
              <TaskList tasks={tasks} callbacks={callbacks} />
            </div>
          </SortableContext>

          <DragOverlay>
            {activeTask ? (
              <div className="rounded-sm bg-card border border-arcane/30 px-4 py-2 shadow-lg shadow-arcane/10">
                <span className="text-sm font-medium text-foreground">{activeTask.title}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
