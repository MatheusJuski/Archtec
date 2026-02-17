import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { AuthGuard } from "@/components/AuthGuard";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <BrowserRouter>
      <div className="bg-slate-950 min-h-screen text-slate-50">
        <Routes>
          
          {/* Rota Pública (Login) */}
          <Route element={<AuthGuard isPrivate={false} />}>
            {/* Agora usamos o componente de página completa */}
            <Route path="/login" element={<LoginPage />} /> 
          </Route>

          {/* Rota Privada (Dashboard) */}
          <Route element={<AuthGuard isPrivate={true} />}>
            <Route path="/" element={<Dashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        
        <Toaster position="top-right" richColors />
      </div>
    </BrowserRouter>
  );
}

export default App;