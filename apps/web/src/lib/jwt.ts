interface JwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
}

/** Lê o payload do JWT sem validar a assinatura (a validação é do backend). */
export function decodeJwt(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** true se o token já venceu (com folga de 10 s para relógio desajustado). */
export function isTokenExpired(token: string | null | undefined): boolean {
  const exp = decodeJwt(token)?.exp;
  if (!exp) return false;
  return Date.now() >= exp * 1000 - 10_000;
}
