import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { TaskList, type TaskCallbacks } from "@/components/TaskItem";
import { flattenTaskIds, type Task } from "@/lib/task-tree";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "motion/react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Divider } from "@/components/ui/divider";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [newDueDate, setNewDueDate] = useState("");
  const [newRecurring, setNewRecurring] = useState(false);
  const [newRecurrenceFrequency, setNewRecurrenceFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY">("WEEKLY");
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const payload = {
        title,
        dueDate: newDueDate ? new Date(`${newDueDate}T12:00:00`).toISOString() : undefined,
        isRecurring: newRecurring,
        recurrenceFrequency: newRecurring ? newRecurrenceFrequency : undefined,
      };
      const res = await api.post("/tasks", payload);
      const created: Task = { ...res.data, children: [] };
      setTasks((prev) => [...prev, created]);
      setNewTitle("");
      setNewDueDate("");
      setNewRecurring(false);
      inputRef.current?.focus();
    } catch {
      toast.error("Erro ao criar tarefa");
    } finally {
      setCreating(false);
    }
  }, [newTitle, newDueDate, newRecurring, newRecurrenceFrequency]);

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
      api.patch(`/tasks/${taskId}/move`, { parentId: newParentId, order: newSiblingCount }).catch((error) => {
        toast.error(getApiErrorMessage(error, "Erro ao mover tarefa"));
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
      api.patch(`/tasks/${taskId}/move`, { parentId: grandparentId, order: parentIdx + 1 }).catch((error) => {
        toast.error(getApiErrorMessage(error, "Erro ao mover tarefa"));
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
      api.patch(`/tasks/${draggedId}/move`, { parentId: newParentId, order: overIndex }).catch((error) => {
        toast.error(getApiErrorMessage(error, "Erro ao reordenar tarefa"));
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

  const counts = (function count(list: Task[]): { total: number; done: number } {
    return list.reduce(
      (acc, t) => {
        const sub = count(t.children ?? []);
        return {
          total: acc.total + 1 + sub.total,
          done: acc.done + (t.status === "completed" ? 1 : 0) + sub.done,
        };
      },
      { total: 0, done: 0 },
    );
  })(tasks);
  const progress = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-5 py-8 md:px-10 md:py-12">
        <PageHeader
          eyebrow="03 / Tarefas"
          title="Tarefas"
          description="Arraste para reordenar. Tab e Shift+Tab ajustam a hierarquia."
          actions={
            counts.total > 0 && (
              <div className="flex items-center gap-3">
                <span className="label-tech tabular-nums text-muted-foreground">
                  {counts.done}/{counts.total} concluídas
                </span>
                <div className="relative h-2 w-28 border border-ink" aria-hidden>
                  <motion.span
                    className="absolute inset-y-0 left-0 bg-brand"
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            )
          }
        />

        {/* ═══ Nova tarefa ═══ */}
        <Panel title="Nova tarefa" className="mb-8">
          <div className="flex items-stretch gap-2">
            <Input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="O que precisa ser feito?"
              className="h-10 flex-1 text-base"
              disabled={creating}
            />
            <Button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
              variant="brand"
              size="icon"
              className="h-10 w-10"
              aria-label="Criar tarefa"
            >
              {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            </Button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="h-9 font-mono text-xs"
              aria-label="Data de vencimento"
            />

            <label className="flex h-9 cursor-pointer items-center gap-2.5 border border-line bg-card px-3 text-sm transition-colors hover:border-ink/50">
              <input
                type="checkbox"
                checked={newRecurring}
                onChange={(e) => setNewRecurring(e.target.checked)}
                className="size-3.5 accent-[var(--brand)]"
              />
              Recorrente
            </label>

            <select
              className="arch-picker h-9 disabled:opacity-50"
              value={newRecurrenceFrequency}
              onChange={(e) => setNewRecurrenceFrequency(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY")}
              disabled={!newRecurring}
              aria-label="Frequência"
            >
              <option value="DAILY">Diária</option>
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensal</option>
              <option value="YEARLY">Anual</option>
            </select>
          </div>
        </Panel>

        <Divider label="Hierarquia" className="mb-4" />

        {/* ═══ Conteúdo ═══ */}
        {loading ? (
          <div className="grid gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10" style={{ marginLeft: `${(i % 3) * 1.5}rem` }} />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="hatch flex flex-1 flex-col items-center justify-center gap-3 border border-dashed border-line px-6 py-16 text-center">
            <div className="grid size-12 place-items-center border border-ink bg-card">
              <Plus className="h-5 w-5" />
            </div>
            <p className="font-heading text-xl font-bold">Nenhuma tarefa encontrada</p>
            <p className="text-sm text-muted-foreground">Crie sua primeira tarefa acima.</p>
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
              <div className="border border-ink bg-card py-1">
                <TaskList tasks={tasks} callbacks={callbacks} />
              </div>
            </SortableContext>

            <DragOverlay>
              {activeTask ? (
                <div className="border border-ink border-l-[3px] border-l-brand bg-card px-4 py-2 shadow-[4px_4px_0_0_var(--ink)]">
                  <span className="text-sm font-medium text-foreground">{activeTask.title}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
