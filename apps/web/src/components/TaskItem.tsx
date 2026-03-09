import {
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  Flame,
  Shield,
  Zap,
  CircleDot,
  CheckCircle2,
  GripVertical,
} from "lucide-react";
import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  order: number;
  dueDate: string | null;
  completedAt: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  children?: Task[];
}

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

/** Achata a árvore em uma lista de IDs na ordem visível (preorder DFS) */
export function flattenTaskIds(tasks: Task[], expanded: Set<string>): string[] {
  const result: string[] = [];
  for (const task of tasks) {
    result.push(task.id);
    if (task.children?.length && expanded.has(task.id)) {
      result.push(...flattenTaskIds(task.children, expanded));
    }
  }
  return result;
}

/** Retorna um map id → level para toda a árvore */
export function buildLevelMap(tasks: Task[], level = 0): Map<string, number> {
  const map = new Map<string, number>();
  for (const task of tasks) {
    map.set(task.id, level);
    if (task.children?.length) {
      for (const [k, v] of buildLevelMap(task.children, level + 1)) {
        map.set(k, v);
      }
    }
  }
  return map;
}

const priorityConfig: Record<string, { icon: typeof Flame; color: string; glow: string }> = {
  urgent: {
    icon: Flame,
    color: "text-ember",
    glow: "drop-shadow-[0_0_4px_rgba(212,102,58,0.5)]",
  },
  high: {
    icon: Zap,
    color: "text-arcane-glow",
    glow: "drop-shadow-[0_0_4px_rgba(230,198,90,0.4)]",
  },
  medium: {
    icon: Shield,
    color: "text-arcane",
    glow: "",
  },
  low: {
    icon: CircleDot,
    color: "text-relic",
    glow: "",
  },
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
      className={`relative ${isDragging ? "z-50 opacity-70" : ""}`}
    >
      {/* Linha de conexão vertical para sub-tarefas */}
      {level > 0 && !isDragging && (
        <div
          className="absolute top-0 bottom-0 w-px bg-linear-to-b from-arcane/30 to-transparent"
          style={{ left: `${(level - 1) * 1.5 + 0.75}rem` }}
        />
      )}

      <div
        className={`
          group relative flex items-center gap-2.5 rounded-sm px-3 py-2
          transition-all duration-200
          hover:bg-muted/60
          ${isCompleted ? "opacity-60" : ""}
          ${isDragging ? "bg-card shadow-lg shadow-arcane/10 ring-1 ring-arcane/30" : ""}
        `}
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
          className="flex h-5 w-5 shrink-0 cursor-grab items-center justify-center text-relic/50 hover:text-arcane active:cursor-grabbing transition-colors"
          {...attributes}
          {...listeners}
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {/* Chevron expandir/colapsar */}
        <button
          className="flex h-5 w-5 shrink-0 items-center justify-center text-relic hover:text-arcane transition-colors"
          onClick={() => hasChildren && setExpanded((prev) => !prev)}
          aria-label={expanded ? "Recolher" : "Expandir"}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="h-4 w-4" />
          )}
        </button>

        {/* Ícone de prioridade / status — clicável para toggle complete */}
        <button
          className="shrink-0 transition-transform hover:scale-110"
          onClick={() => callbacks.onToggleComplete(task.id)}
          aria-label={isCompleted ? "Reabrir tarefa" : "Concluir tarefa"}
          title={isCompleted ? "Reabrir" : "Concluir"}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-toxic drop-shadow-[0_0_4px_rgba(123,201,106,0.5)]" />
          ) : (
            <PriorityIcon className={`h-4 w-4 ${priority.color} ${priority.glow}`} />
          )}
        </button>

        {/* Linha decorativa horizontal */}
        {level > 0 && !isDragging && (
          <div className="absolute top-1/2 h-px w-3 bg-arcane/20"
            style={{ left: `${(level - 1) * 1.5 + 0.75}rem` }}
          />
        )}

        {/* Título */}
        <span
          className={`flex-1 text-sm font-medium truncate transition-colors ${
            isCompleted
              ? "text-muted-foreground line-through decoration-relic/50"
              : "text-foreground"
          }`}
        >
          {task.title}
        </span>

        {/* Botões Indent / Outdent */}
        {(canOutdent || canIndent) && (
          <div className="flex shrink-0 items-center gap-0.5 border border-border/50 rounded-sm overflow-hidden">
            {canOutdent && (
              <button
                className="flex items-center gap-1 px-1.5 py-0.5 text-relic hover:text-arcane-glow hover:bg-ash/50 transition-colors text-[11px]"
                onClick={() => callbacks.onOutdent(task.id)}
                title="Promover (Shift+Tab)"
                aria-label="Promover tarefa"
              >
                <ArrowLeft className="h-3 w-3" />
              </button>
            )}
            {canIndent && (
              <button
                className="flex items-center gap-1 px-1.5 py-0.5 text-relic hover:text-arcane-glow hover:bg-ash/50 transition-colors text-[11px]"
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
