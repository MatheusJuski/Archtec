import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth";

interface AuthGuardProps {
  isPrivate: boolean;
}

export function AuthGuard({ isPrivate }: AuthGuardProps) {
  // Acessa o estado global para saber se tem token válido
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Lógica 1: Rota Privada (Dashboard) mas usuário NÃO está logado
  // Ação: Chuta para o Login
  if (isPrivate && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Lógica 2: Rota Pública (Login) mas usuário JÁ está logado
  // Ação: Manda direto para a Dashboard (não faz sentido logar de novo)
  if (!isPrivate && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Se passou nas validações, renderiza a rota solicitada (Outlet)
  return <Outlet />;
}