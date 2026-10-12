import { Suspense, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { FileText, ListChecks, CalendarDays, Sun, Moon, LogOut, Landmark, LayoutDashboard, MoreHorizontal, Search } from "lucide-react";
import { useThemeStore } from "@/store/theme";
import { useAuthStore } from "@/store/auth";
import { SearchAllCommand } from "@/components/SearchAllCommand";
import { OPEN_SEARCH_EVENT } from "@/lib/events";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { prefetchRoute, type RouteKey } from "@/routes";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const navItems: { to: string; route: RouteKey; icon: typeof FileText; label: string }[] = [
  { to: "/dashboard", route: "dashboard", icon: LayoutDashboard, label: "Hoje" },
  { to: "/notes", route: "notes", icon: FileText, label: "Notas" },
  { to: "/tasks", route: "tasks", icon: ListChecks, label: "Tarefas" },
  { to: "/calendar", route: "calendar", icon: CalendarDays, label: "Calendário" },
  { to: "/finance", route: "finance", icon: Landmark, label: "Finanças" },
];

function PageFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12" aria-busy="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-12 w-64" />
      <Skeleton className="mt-8 h-64 border border-line" />
    </div>
  );
}

const railButton =
  "group relative flex h-11 w-11 items-center justify-center text-ink-muted transition-colors hover:text-foreground";

function RailTooltip({ label }: { label: string }) {
  return (
    <span className="chip pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-x-1 -translate-y-1/2 whitespace-nowrap opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
      {label}
    </span>
  );
}

export function AppLayout() {
  const { theme, toggleTheme } = useThemeStore();
  const signOut = useAuthStore((s) => s.signOut);
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  // Anima só ao trocar de seção (não ao trocar de nota em /notes/:id)
  const section = location.pathname.split("/")[1] ?? "";

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* ═══ Rail de navegação (desktop) ═══ */}
      <nav
        aria-label="Navegação principal"
        className="relative hidden w-18 shrink-0 flex-col items-center border-r border-ink bg-card py-5 md:flex"
      >
        <span aria-hidden className="hatch absolute inset-y-0 right-0 w-1.5 translate-x-full border-r border-line" />

        <NavLink to="/dashboard" className="mb-8 text-foreground" aria-label="Archtec — início">
          <Logo className="h-9" />
        </NavLink>

        <div className="flex flex-1 flex-col items-center gap-1.5">
          {navItems.map(({ to, route, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              onMouseEnter={() => prefetchRoute(route)}
              onFocus={() => prefetchRoute(route)}
              className={({ isActive }) => cn(railButton, isActive && "text-brand-foreground hover:text-brand-foreground")}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="rail-active"
                      className="absolute inset-0 border border-ink bg-brand"
                      transition={{ type: "spring", stiffness: 520, damping: 38 }}
                    />
                  )}
                  <Icon className="relative h-4.5 w-4.5" />
                  <RailTooltip label={label} />
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="flex flex-col items-center gap-1.5 border-t border-line pt-4">
          <SearchAllCommand />
          <button
            onClick={toggleTheme}
            className={railButton}
            aria-label={theme === "dark" ? "Tema claro" : "Tema escuro"}
          >
            <motion.span
              key={theme}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex"
            >
              {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </motion.span>
            <RailTooltip label={theme === "dark" ? "Tema claro" : "Tema escuro"} />
          </button>
          <button onClick={signOut} className={cn(railButton, "hover:text-destructive")} aria-label="Sair">
            <LogOut className="h-4.5 w-4.5" />
            <RailTooltip label="Sair" />
          </button>
        </div>
      </nav>

      {/* ═══ Conteúdo da página ═══ */}
      <main className="relative flex-1 overflow-hidden pb-16 md:pb-0 md:pl-1.5">
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="h-full"
        >
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </motion.div>
      </main>

      {/* ═══ Barra inferior (mobile) ═══ */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-ink bg-card md:hidden"
      >
        {navItems.map(({ to, route, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onTouchStart={() => prefetchRoute(route)}
            className={({ isActive }) =>
              cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 text-ink-muted transition-colors",
                isActive && "text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="bottom-active"
                    className="absolute inset-x-3 top-0 h-0.75 bg-brand"
                    transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  />
                )}
                <Icon className="h-4.5 w-4.5" />
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.06em]">{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex w-14 flex-col items-center justify-center gap-1 border-l border-line text-ink-muted"
          aria-label="Mais opções"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal className="h-4.5 w-4.5" />
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.06em]">Mais</span>
        </button>
      </nav>

      {/* ═══ Folha "Mais" (mobile): busca, tema e sair ═══ */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.button
              aria-label="Fechar menu"
              className="fixed inset-0 z-40 bg-surface-1/70 backdrop-blur-[2px] md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-label="Mais opções"
              className="fixed inset-x-0 bottom-0 z-50 border-t border-ink bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
              <p className="label-tech border-b border-line px-5 py-3 text-muted-foreground">Mais opções</p>
              {[
                {
                  label: "Buscar",
                  hint: "Notas, tarefas e eventos",
                  icon: <Search className="h-4.5 w-4.5" />,
                  onClick: () => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT)),
                },
                {
                  label: theme === "dark" ? "Tema claro" : "Tema escuro",
                  hint: "Alternar aparência",
                  icon: theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />,
                  onClick: toggleTheme,
                },
                {
                  label: "Sair",
                  hint: "Encerrar sessão",
                  icon: <LogOut className="h-4.5 w-4.5" />,
                  onClick: signOut,
                  danger: true,
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setMoreOpen(false);
                    item.onClick();
                  }}
                  className={cn(
                    "flex w-full items-center gap-4 border-b border-line px-5 py-4 text-left transition-colors active:bg-surface-2",
                    item.danger && "text-destructive",
                  )}
                >
                  {item.icon}
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{item.hint}</span>
                  </span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
