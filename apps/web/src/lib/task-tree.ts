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
