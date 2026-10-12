import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { routeLoaders } from "@/routes";
import { AuthGuard } from "@/components/AuthGuard";
import { AppLayout } from "@/components/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { ServerWakeIndicator } from "@/components/ServerWakeIndicator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect } from "react";
import { useThemeStore } from "@/store/theme";

// Cada página é um chunk próprio, baixado só quando necessário
const LoginPage = lazy(() => routeLoaders.login().then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => routeLoaders.dashboard().then((m) => ({ default: m.DashboardPage })));
const NotesPage = lazy(() => routeLoaders.notes().then((m) => ({ default: m.NotesPage })));
const TasksPage = lazy(() => routeLoaders.tasks().then((m) => ({ default: m.TasksPage })));
const CalendarPage = lazy(() => routeLoaders.calendar().then((m) => ({ default: m.CalendarPage })));
const FinancePage = lazy(() => routeLoaders.finance().then((m) => ({ default: m.FinancePage })));

function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="bg-background min-h-screen text-foreground">
        <ErrorBoundary fullScreen>
        <Routes>
          {/* 1. Rota Raiz */}
          <Route path="/" element={<Navigate to="/notes" replace />} />

          {/* 2. Rota Pública (Login) */}
          <Route element={<AuthGuard isPrivate={false} />}>
            <Route
              path="/login"
              element={
                <Suspense fallback={<div className="min-h-dvh bg-background" />}>
                  <LoginPage />
                </Suspense>
              }
            />
          </Route>

          {/* 3. Rotas Privadas com Layout global */}
          <Route element={<AuthGuard isPrivate={true} />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/notes/:id" element={<NotesPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/finance" element={<FinancePage />} />
            </Route>
          </Route>

          {/* 4. Rota Coringa Segura */}
          <Route path="*" element={<Navigate to="/notes" replace />} />
        </Routes>
        </ErrorBoundary>

        <Toaster position="top-right" richColors />
        <ServerWakeIndicator />
      </div>
    </BrowserRouter>
  );
}

export default App;