import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const MAX_ICS_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

export class IcsFetchError extends Error {}

/** Aceita links webcal:// (formato comum de "assinar calendário") convertendo para https. */
export function normalizeCalendarUrl(raw: string): URL {
  let value = raw.trim();
  if (/^webcals?:\/\//i.test(value)) {
    value = value.replace(/^webcals?:\/\//i, 'https://');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new IcsFetchError('Link de calendário inválido');
  }

  if (url.protocol !== 'https:') {
    throw new IcsFetchError('Use um link https:// ou webcal://');
  }
  if (url.username || url.password) {
    throw new IcsFetchError('Link de calendário inválido');
  }
  return url;
}

function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase();

  if (isIP(ip) === 6) {
    if (ip === '::1' || ip === '::') return true;
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // ULA
    if (/^fe[89ab]/.test(ip)) return true; // link-local
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }

  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / metadata de cloud
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** Evita que o servidor seja usado para acessar endereços internos (SSRF). */
async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new IcsFetchError('Endereço não permitido');
  }

  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new IcsFetchError(
          'Não foi possível encontrar o servidor do link',
        );
      });

  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new IcsFetchError('Endereço não permitido');
  }
}

async function readLimited(response: Response): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_ICS_BYTES) {
    throw new IcsFetchError('O calendário é grande demais (máx. 10 MB)');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ICS_BYTES) {
      await reader.cancel();
      throw new IcsFetchError('O calendário é grande demais (máx. 10 MB)');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function fetchIcs(rawUrl: string): Promise<string> {
  let url = normalizeCalendarUrl(rawUrl);

  for (let redirects = 0; ; redirects++) {
    await assertPublicHost(url);

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5' },
      });
    } catch {
      throw new IcsFetchError('Não foi possível baixar o calendário do link');
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirects >= MAX_REDIRECTS) {
        throw new IcsFetchError('O link redirecionou vezes demais');
      }
      url = normalizeCalendarUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) {
      throw new IcsFetchError(
        response.status === 404 || response.status === 403
          ? 'O link não está acessível. Confira se o calendário está publicado/compartilhado.'
          : `O servidor do calendário respondeu com erro ${response.status}`,
      );
    }

    return readLimited(response);
  }
}
