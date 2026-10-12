import axios from "axios";
import { useAuthStore } from "@/store/auth";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3333",
});

// Interceptor de Requisição: Injeta o token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de Resposta: Trata erro 401 (Token expirado)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 numa requisição autenticada = token vencido/inválido. No login (sem token) é só senha errada.
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      useAuthStore.getState().expireSession();
    }
    return Promise.reject(error);
  }
);
/** Status HTTP de um erro do axios (undefined = erro de rede, sem resposta). */
export function getApiErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

/** Mensagem vinda da API (Nest devolve string ou lista de strings), ou o fallback. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  const message: unknown = error.response?.data?.message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  if (typeof message === "string" && message.trim()) return message;
  return fallback;
}

/** Mensagem padrão para rate limit (429). */
export const RATE_LIMIT_MESSAGE = "Muitas tentativas. Aguarde um minuto e tente novamente.";
