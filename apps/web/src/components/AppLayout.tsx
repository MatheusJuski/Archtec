import { Outlet, NavLink } from "react-router-dom";
import { FileText, ListChecks, CalendarDays, Sun, Moon, LogOut, Landmark } from "lucide-react";
import { useThemeStore } from "@/store/theme";
import { useAuthStore } from "@/store/auth";
import { SearchAllCommand } from "@/components/SearchAllCommand";
import logo from "@/assets/favicon.svg";

const navItems = [
  { to: "/notes", icon: FileText, label: "Notas" },
  { to: "/tasks", icon: ListChecks, label: "Tarefas" },
  { to: "/calendar", icon: CalendarDays, label: "Calendario" },
  { to: "/finance", icon: Landmark, label: "Financas" },
];

export function AppLayout() {
  const { theme, toggleTheme } = useThemeStore();
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* ═══ Sidebar de navegação ═══ */}
      <nav className="flex w-14 shrink-0 flex-col items-center border-r border-border bg-card py-4 gap-2">
        {/* Logo */}
        <div className="mb-4 flex h-8 w-8 items-center justify-center">
          <img src={logo} alt="Architec" className="h-8 w-8 rounded-sm" />
        </div>

        {/* Nav links */}
        <div className="flex flex-1 flex-col items-center gap-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex h-10 w-10 items-center justify-center rounded-sm transition-all ${
                  isActive
                    ? "bg-arcane/15 text-arcane shadow-[0_0_8px_rgba(201,168,76,0.15)]"
                    : "text-relic hover:text-arcane-glow hover:bg-muted/50"
                }`
              }
              title={label}
            >
              <Icon className="h-4.5 w-4.5" />
            </NavLink>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-1">
          <SearchAllCommand />
          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-sm text-relic hover:text-arcane hover:bg-muted/50 transition-colors"
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          >
            {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>
          <button
            onClick={signOut}
            className="flex h-10 w-10 items-center justify-center rounded-sm text-relic hover:text-ember hover:bg-muted/50 transition-colors"
            title="Sair"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </nav>

      {/* ═══ Conteúdo da página ═══ */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
