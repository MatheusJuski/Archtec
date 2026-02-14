import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  signIn: (token: string) => void;
  signOut: () => void;
  isAuthenticated: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,

      signIn: (token: string) => {
        set({ token, isAuthenticated: true });
      },

      signOut: () => {
        set({ token: null, isAuthenticated: false });
        localStorage.removeItem("architect-auth");
      },
    }),
    {
      name: "architect-auth",
    }
  )
);