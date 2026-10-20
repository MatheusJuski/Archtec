import * as ical from 'node-ical';
import type { ParameterValue } from 'node-ical';

/** Janela de expansão: eventos recorrentes viram ocorrências individuais dentro dela. */
export const IMPORT_WINDOW_PAST_DAYS = 365;
export const IMPORT_WINDOW_FUTURE_DAYS = 730;
export const MAX_EVENTS_PER_SOURCE = 5000;

const MAX_TITLE_LENGTH = 300;
const MAX_LOCATION_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 10_000;
const DEFAULT_TIMED_DURATION_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ParsedIcsEvent {
  externalUid: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
}

export interface ParsedIcsCalendar {
  calendarName: string | null;
  events: ParsedIcsEvent[];
  truncated: boolean;
}

function textOf(value: ParameterValue | undefined | null): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && 'val' in value) {
    return String(value.val ?? '').trim();
  }
  return String(value).trim();
}

function truncate(value: string, max: number) {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Eventos de dia inteiro são guardados como meia-noite UTC do dia do calendário
 * (fim exclusivo, como no iCal), para não "andarem" de dia com o fuso do servidor/usuário.
 */
function toAllDayUtc(date: Date & { tz?: string }): Date {
  if (date.tz) {
    try {
      const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: date.tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
      return new Date(`${day}T00:00:00.000Z`);
    } catch {
      // fuso desconhecido: cai no cálculo local abaixo
    }
  }
  // node-ical cria datas sem fuso (VALUE=DATE) à meia-noite local do servidor
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

export async function parseIcs(
  content: string,
  now = new Date(),
): Promise<ParsedIcsCalendar> {
  const data = await ical.async.parseICS(content);

  const from = new Date(now.getTime() - IMPORT_WINDOW_PAST_DAYS * DAY_MS);
  const to = new Date(now.getTime() + IMPORT_WINDOW_FUTURE_DAYS * DAY_MS);

  const events: ParsedIcsEvent[] = [];
  let hasCalendar = false;

  for (const component of Object.values(data)) {
    if (!component || typeof component !== 'object') continue;
    if (component.type === 'VCALENDAR') {
      hasCalendar = true;
      continue;
    }
    if (component.type !== 'VEVENT') continue;
    hasCalendar = true;

    const vevent = component;
    if (vevent.status === 'CANCELLED' || !vevent.start) continue;

    let instances: ReturnType<typeof ical.expandRecurringEvent>;
    try {
      instances = ical.expandRecurringEvent(vevent, {
        from,
        to,
        expandOngoing: true,
      });
    } catch {
      // Um evento com regra malformada não deve impedir a importação do resto
      continue;
    }

    for (const instance of instances) {
      const source = instance.event ?? vevent;
      if (source.status === 'CANCELLED') continue;

      const allDay = instance.isFullDay;
      let startTime: Date;
      let endTime: Date;

      if (allDay) {
        startTime = toAllDayUtc(instance.start);
        endTime = instance.end ? toAllDayUtc(instance.end) : startTime;
        if (endTime <= startTime) {
          endTime = new Date(startTime.getTime() + DAY_MS);
        }
      } else {
        startTime = new Date(instance.start.getTime());
        endTime = instance.end
          ? new Date(instance.end.getTime())
          : new Date(startTime.getTime() + DEFAULT_TIMED_DURATION_MS);
        if (endTime <= startTime) {
          endTime = new Date(startTime.getTime() + DEFAULT_TIMED_DURATION_MS);
        }
      }

      const title =
        textOf(instance.summary) || textOf(source.summary) || '(Sem título)';
      const description = textOf(source.description);
      const location = textOf(source.location);

      events.push({
        externalUid: `${vevent.uid}::${startTime.toISOString()}`,
        title: truncate(title, MAX_TITLE_LENGTH),
        description: description
          ? truncate(description, MAX_DESCRIPTION_LENGTH)
          : null,
        location: location ? truncate(location, MAX_LOCATION_LENGTH) : null,
        startTime,
        endTime,
        allDay,
      });
    }
  }

  if (!hasCalendar) {
    throw new Error('O conteúdo não é um calendário iCal (.ics) válido');
  }

  events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const truncated = events.length > MAX_EVENTS_PER_SOURCE;
  const vcalendar = data.vcalendar;
  const calendarName = vcalendar?.['WR-CALNAME']?.trim() || null;

  return {
    calendarName,
    events: truncated ? events.slice(0, MAX_EVENTS_PER_SOURCE) : events,
    truncated,
  };
}
