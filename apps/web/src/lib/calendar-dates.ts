/**
 * Eventos de dia inteiro chegam da API como meia-noite UTC do dia do calendário
 * (fim exclusivo, padrão iCal). Convertê-los com `new Date(iso)` faria o evento
 * "voltar" um dia no fuso do Brasil, então usamos os componentes UTC como data local.
 */
export function allDayToLocalDate(iso: string): Date {
  const date = new Date(iso);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Data local (meia-noite) → meia-noite UTC do mesmo dia, no formato esperado pela API. */
export function localDateToAllDayIso(date: Date): string {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString();
}
