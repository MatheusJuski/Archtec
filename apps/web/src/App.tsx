import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/Login";
import { NotesPage } from "@/pages/NotesPage";
import { TasksPage } from "@/pages/TasksPage";
import { AuthGuard } from "@/components/AuthGuard";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { useThemeStore } from "@/store/theme";

function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="bg-background min-h-screen text-foreground">
        <Routes>
          
          {/* 1. Rota Raiz: Redireciona direto para o painel principal */}
          <Route path="/" element={<Navigate to="/notes" replace />} />

          {/* 2. Rota Pública (Login) */}
          <Route element={<AuthGuard isPrivate={false} />}>
            <Route path="/login" element={<LoginPage />} /> 
          </Route>

          {/* 3. Rotas Privadas (Dashboard/Architec) */}
          <Route element={<AuthGuard isPrivate={true} />}>
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/notes/:id" element={<NotesPage />} />
            <Route path="/tasks" element={<TasksPage />} />
          </Route>

          {/* 4. Rota Coringa Segura: Manda para /notes em vez de /login */}
          <Route path="*" element={<Navigate to="/notes" replace />} />
          
        </Routes>
        
        <Toaster position="top-right" richColors />
      </div>
    </BrowserRouter>
  );
}

export default App;