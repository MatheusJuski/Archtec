import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginForm } from "@/components/LoginForm";
import { Dashboard } from "@/pages/Dashboard";
import { AuthGuard } from "@/components/AuthGuard";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <BrowserRouter>
      {/* Container principal com fundo escuro */}
      <div className="bg-slate-950 min-h-screen text-slate-50">
        
        <Routes>
          <Route element={<AuthGuard isPrivate={false} />}>
            <Route 
              path="/login" 
              element={
                <div className="flex h-screen w-full items-center justify-center">
                  <LoginForm />
                </div>
              } 
            />
          </Route>

          <Route element={<AuthGuard isPrivate={true} />}>
            <Route path="/" element={<Dashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>

        {/* Componente de avisos (Toast) fica global aqui */}
        <Toaster position="top-right" richColors />
      </div>
    </BrowserRouter>
  );
}

export default App;