import type { Request } from 'express';

/** Payload que assinamos no JWT (users.service). */
export interface JwtPayload {
  sub: string;
  email: string;
}

/** Usuário anexado em req.user pela JwtStrategy. */
export interface AuthUser {
  userId: string;
  email: string;
}

/** Request de rotas protegidas pelo JwtAuthGuard. */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
