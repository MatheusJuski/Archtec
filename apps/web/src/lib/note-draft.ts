import { decodeJwt } from "@/lib/jwt";
import { useAuthStore } from "@/store/auth";

const DRAFT_KEY = "archtec-note-draft";

export interface NoteDraft {
  /** Dono do rascunho (sub do JWT): nunca oferecer o rascunho de outra conta */
  userId: string;
  /** null = nota nova ainda não criada no servidor */
  noteId: string | null;
  title: string;
  content: string;
  tags: string[];
  savedAt: number;
}

function currentUserId(): string | null {
  return decodeJwt(useAuthStore.getState().token)?.sub ?? null;
}

/** Guarda as alterações ainda não confirmadas pelo servidor. */
export function saveNoteDraft(draft: Omit<NoteDraft, "userId" | "savedAt">) {
  const userId = currentUserId();
  if (!userId) return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, userId, savedAt: Date.now() }));
  } catch {
    // Sem espaço/acesso ao localStorage: o rascunho é só uma rede de segurança
  }
}

/** Rascunho do usuário logado, se houver. */
export function loadNoteDraft(): NoteDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as NoteDraft;
    return draft.userId === currentUserId() ? draft : null;
  } catch {
    return null;
  }
}

export function clearNoteDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
