/**
 * Carregadores das páginas: cada uma vira um chunk separado (code splitting).
 * O import() é cacheado pelo navegador, então chamar o loader antes (prefetch)
 * faz a navegação parecer instantânea.
 */
export const routeLoaders = {
  login: () => import("@/pages/Login"),
  dashboard: () => import("@/pages/DashboardPage"),
  notes: () => import("@/pages/NotesPage"),
  tasks: () => import("@/pages/TasksPage"),
  calendar: () => import("@/pages/CalendarPage"),
  finance: () => import("@/pages/FinancePage"),
} as const;

export type RouteKey = keyof typeof routeLoaders;

/** Baixa o código de uma página antes do clique (hover/foco no menu). Falhas são ignoradas. */
export function prefetchRoute(key: RouteKey) {
  routeLoaders[key]().catch(() => {});
}
