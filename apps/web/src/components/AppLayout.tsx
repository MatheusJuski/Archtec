import { Outlet, NavLink, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { FileText, ListChecks, CalendarDays, Sun, Moon, LogOut, Landmark, LayoutDashboard } from "lucide-react";
import { useThemeStore } from "@/store/theme";
import { useAuthStore } from "@/store/auth";
import { SearchAllCommand } from "@/components/SearchAllCommand";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Hoje" },
  { to: "/notes", icon: FileText, label: "Notas" },
  { to: "/tasks", icon: ListChecks, label: "Tarefas" },
  { to: "/calendar", icon: CalendarDays, label: "Calendário" },
  { to: "/finance", icon: Landmark, label: "Finanças" },
];

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
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
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
          <Outlet />
        </motion.div>
      </main>

      {/* ═══ Barra inferior (mobile) ═══ */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-ink bg-card md:hidden"
      >
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
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
          onClick={toggleTheme}
          className="flex w-14 items-center justify-center border-l border-line text-ink-muted"
          aria-label={theme === "dark" ? "Tema claro" : "Tema escuro"}
        >
          {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </button>
      </nav>
    </div>
  );
}
