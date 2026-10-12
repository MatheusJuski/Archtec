import { ThrottlerModuleOptions } from '@nestjs/throttler';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Rate limit por IP, aplicado globalmente.
 * O armazenamento é em memória: adequado para uma única instância (ex.: Render free).
 */
export const throttlerOptions: ThrottlerModuleOptions = {
  throttlers: [
    { name: 'default', ttl: MINUTE, limit: 120 },
    { name: 'hourly', ttl: HOUR, limit: 3000 },
  ],
  errorMessage: 'Muitas requisições. Aguarde um pouco e tente novamente.',
};

/** Limite mais rígido para rotas de autenticação (força bruta de senha). */
export const authThrottle = {
  default: { ttl: MINUTE, limit: 10 },
  hourly: { ttl: HOUR, limit: 50 },
};
