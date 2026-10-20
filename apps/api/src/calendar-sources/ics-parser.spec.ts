import { parseIcs } from './ics-parser';
import { IcsFetchError, normalizeCalendarUrl } from './ics-fetcher';

const NOW = new Date('2026-10-20T12:00:00.000Z');

const SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
X-WR-CALNAME:Trabalho
BEGIN:VEVENT
UID:feriado-1
DTSTART;VALUE=DATE:20261021
DTEND;VALUE=DATE:20261023
SUMMARY:Feriado
END:VEVENT
BEGIN:VEVENT
UID:weekly-1
DTSTART;TZID=America/Sao_Paulo:20261019T090000
DTEND;TZID=America/Sao_Paulo:20261019T100000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4
EXDATE;TZID=America/Sao_Paulo:20261021T090000
SUMMARY:Daily
LOCATION:Sala 1
DESCRIPTION:Pauta da semana
END:VEVENT
BEGIN:VEVENT
UID:cancelado-1
DTSTART:20261025T150000Z
DTEND:20261025T160000Z
STATUS:CANCELLED
SUMMARY:Cancelado
END:VEVENT
END:VCALENDAR`;

describe('parseIcs', () => {
  it('expande recorrências, respeita EXDATE e ignora cancelados', async () => {
    const result = await parseIcs(SAMPLE, NOW);

    expect(result.calendarName).toBe('Trabalho');
    expect(result.truncated).toBe(false);

    const daily = result.events.filter((e) => e.title === 'Daily');
    expect(daily.map((e) => e.startTime.toISOString())).toEqual([
      '2026-10-19T12:00:00.000Z',
      '2026-10-26T12:00:00.000Z',
      '2026-10-28T12:00:00.000Z',
    ]);
    expect(daily[0]).toMatchObject({
      location: 'Sala 1',
      description: 'Pauta da semana',
      allDay: false,
    });
    expect(new Set(daily.map((e) => e.externalUid)).size).toBe(3);

    expect(result.events.some((e) => e.title === 'Cancelado')).toBe(false);
  });

  it('guarda eventos de dia inteiro à meia-noite UTC com fim exclusivo', async () => {
    const result = await parseIcs(SAMPLE, NOW);
    const holiday = result.events.find((e) => e.title === 'Feriado');

    expect(holiday).toMatchObject({ allDay: true });
    expect(holiday?.startTime.toISOString()).toBe('2026-10-21T00:00:00.000Z');
    expect(holiday?.endTime.toISOString()).toBe('2026-10-23T00:00:00.000Z');
  });

  it('rejeita conteúdo que não é iCal', async () => {
    await expect(parseIcs('<html>login</html>', NOW)).rejects.toThrow();
  });
});

describe('normalizeCalendarUrl', () => {
  it('converte webcal:// para https://', () => {
    expect(
      normalizeCalendarUrl('webcal://calendar.google.com/x/basic.ics').href,
    ).toBe('https://calendar.google.com/x/basic.ics');
  });

  it('recusa http e outros protocolos', () => {
    expect(() => normalizeCalendarUrl('http://example.com/a.ics')).toThrow(
      IcsFetchError,
    );
    expect(() => normalizeCalendarUrl('file:///etc/passwd')).toThrow(
      IcsFetchError,
    );
  });
});
