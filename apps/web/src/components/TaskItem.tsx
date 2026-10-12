import {
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  Flame,
  Shield,
  Zap,
  CircleDot,
  Check,
  GripVertical,
} from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/lib/task-tree";

export interface TaskCallbacks {
  onIndent: (taskId: string) => void;
  onOutdent: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
}

interface TaskItemProps {
  task: Task;
  level?: number;
  callbacks: TaskCallbacks;
  canIndent: boolean;
  canOutdent: boolean;
}

const priorityConfig: Record<string, { icon: typeof Flame; color: string; label: string }> = {
  urgent: { icon: Flame, color: "text-destructive", label: "Urgente" },
  high: { icon: Zap, color: "text-signal", label: "Alta" },
  medium: { icon: Shield, color: "text-brand", label: "Média" },
  low: { icon: CircleDot, color: "text-muted-foreground", label: "Baixa" },
};

export function TaskItem({
  task,
  level = 0,
  callbacks,
  canIndent,
  canOutdent,
}: TaskItemProps) {
  const hasChildren = task.children && task.children.length > 0;
  const [expanded, setExpanded] = useState(true);
  const isCompleted = task.status === "completed";
  const priority = priorityConfig[task.priority] ?? priorityConfig.medium;
  const PriorityIcon = priority.icon;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative", isDragging && "z-50 opacity-40")}
    >
      {/* Linha de conexão vertical para sub-tarefas */}
      {level > 0 && !isDragging && (
        <div
          className="absolute top-0 bottom-0 w-px bg-line"
          style={{ left: `${(level - 1) * 1.5 + 0.75}rem` }}
        />
      )}

      <div
        className={cn(
          "group relative flex items-center gap-2.5 px-3 py-2 transition-colors duration-150 hover:bg-surface-2/70 focus-visible:bg-surface-2/70 focus-visible:outline-none",
          isCompleted && "opacity-60",
        )}
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Tab" && !e.shiftKey && canIndent) {
            e.preventDefault();
            callbacks.onIndent(task.id);
          }
          if (e.key === "Tab" && e.shiftKey && canOutdent) {
            e.preventDefault();
            callbacks.onOutdent(task.id);
          }
        }}
      >
        {/* Drag handle */}
        <button
          className="flex h-5 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 opacity-0 transition-[opacity,color] hover:text-foreground group-hover:opacity-100 [@media(hover:none)]:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {/* Chevron expandir/colapsar */}
        <button
          className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => hasChildren && setExpanded((prev) => !prev)}
          aria-label={expanded ? "Recolher" : "Expandir"}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="h-4 w-4" />
          )}
        </button>

        {/* Ícone de prioridade / status — clicável para toggle complete */}
        <button
          className={cn(
            "group/check grid size-5 shrink-0 place-items-center border transition-colors",
            isCompleted ? "border-success bg-success text-surface-1" : "border-line hover:border-ink",
          )}
          onClick={() => callbacks.onToggleComplete(task.id)}
          aria-label={isCompleted ? "Reabrir tarefa" : "Concluir tarefa"}
          title={isCompleted ? "Reabrir" : `Concluir · prioridade ${priority.label.toLowerCase()}`}
        >
          {isCompleted ? (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 25 }}>
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </motion.span>
          ) : (
            <PriorityIcon className={cn("h-3 w-3", priority.color)} />
          )}
        </button>

        {/* Linha decorativa horizontal */}
        {level > 0 && !isDragging && (
          <div className="absolute top-1/2 h-px w-3 bg-line"
            style={{ left: `${(level - 1) * 1.5 + 0.75}rem` }}
          />
        )}

        {/* Título */}
        <span
          className={cn(
            "relative min-w-0 flex-1 truncate text-sm transition-colors",
            isCompleted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {task.title}
          <motion.span
            aria-hidden
            className="absolute left-0 top-1/2 h-px w-full origin-left bg-current"
            initial={false}
            animate={{ scaleX: isCompleted ? 1 : 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />
        </span>

        {task.dueDate && (
          <span className="label-tech hidden shrink-0 tabular-nums text-muted-foreground sm:inline">
            {new Date(task.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}
          </span>
        )}

        {/* Botões Indent / Outdent */}
        {(canOutdent || canIndent) && (
          <div className="flex shrink-0 items-center overflow-hidden border border-line opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100 group-focus-within:opacity-100">
            {canOutdent && (
              <button
                className="flex items-center px-1.5 py-1 text-muted-foreground transition-colors hover:bg-ink hover:text-surface-1"
                onClick={() => callbacks.onOutdent(task.id)}
                title="Promover (Shift+Tab)"
                aria-label="Promover tarefa"
              >
                <ArrowLeft className="h-3 w-3" />
              </button>
            )}
            {canIndent && (
              <button
                className="flex items-center px-1.5 py-1 text-muted-foreground transition-colors hover:bg-ink hover:text-surface-1"
                onClick={() => callbacks.onIndent(task.id)}
                title="Rebaixar (Tab)"
                aria-label="Rebaixar tarefa"
              >
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sub-tarefas recursivas */}
      {hasChildren && expanded && (
        <TaskList tasks={task.children!} level={level + 1} callbacks={callbacks} />
      )}
    </div>
  );
}

interface TaskListProps {
  tasks: Task[];
  level?: number;
  callbacks: TaskCallbacks;
}

export function TaskList({ tasks, level = 0, callbacks }: TaskListProps) {
  if (!tasks || tasks.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {tasks.map((task, index) => (
        <TaskItem
          key={task.id}
          task={task}
          level={level}
          callbacks={callbacks}
          canIndent={index > 0}
          canOutdent={level > 0}
        />
      ))}
    </div>
  );
}
