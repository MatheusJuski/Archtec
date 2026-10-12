import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { isTokenExpired } from "@/lib/jwt";

const AUTH_STORAGE_KEY = "archtec-auth";
const LEGACY_AUTH_STORAGE_KEY = "architect-auth";

// Migra a sessão salva com o nome antigo para não deslogar ninguém após o rename
try {
  const legacy = localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
  if (legacy !== null) {
    if (localStorage.getItem(AUTH_STORAGE_KEY) === null) {
      localStorage.setItem(AUTH_STORAGE_KEY, legacy);
    }
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  }
} catch {
  // localStorage indisponível (modo privado restrito): segue sem migrar
}

interface AuthState {
  token: string | null;
  signIn: (token: string) => void;
  signOut: () => void;
  /** Encerra a sessão por expiração, avisando o usuário uma única vez */
  expireSession: () => void;
  isAuthenticated: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      isAuthenticated: false,

      signIn: (token: string) => {
        set({ token, isAuthenticated: true });
      },

      signOut: () => {
        set({ token: null, isAuthenticated: false });
        localStorage.removeItem(AUTH_STORAGE_KEY);
      },

      expireSession: () => {
        // Várias requisições podem receber 401 juntas: só avisa na primeira
        if (!get().isAuthenticated) return;
        get().signOut();
        toast.warning("Sua sessão expirou. Entre novamente para continuar.", {
          id: "session-expired",
          description: "Alterações não salvas em notas ficam guardadas como rascunho.",
        });
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        // Token salvo já vencido: sai antes de disparar requisições que dariam 401
        if (state?.token && isTokenExpired(state.token)) {
          state.signOut();
        }
      },
    }
  )
);