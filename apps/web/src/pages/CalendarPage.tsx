import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  Views,
  View,
  EventPropGetter,
  ToolbarProps,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

interface EventFromApi {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  taskId: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isTimeBlock: boolean;
}

const locales = {
  "pt-BR": ptBR,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

function capitalizeLabel(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function CalendarToolbar({ label, onNavigate, onView, view }: ToolbarProps<CalendarEvent, object>) {
  return (
    <div className="arch-toolbar">
      <div className="arch-toolbar__nav">
        <button type="button" onClick={() => onNavigate("TODAY")}>Hoje</button>
        <button type="button" onClick={() => onNavigate("PREV")}>Anterior</button>
        <button type="button" onClick={() => onNavigate("NEXT")}>Próximo</button>
      </div>

      <div className="arch-toolbar__label">{capitalizeLabel(label)}</div>

      <div className="arch-toolbar__views">
        <button
          type="button"
          onClick={() => onView("month")}
          className={view === Views.MONTH ? "is-active" : ""}
        >
          Mês
        </button>
        <button
          type="button"
          onClick={() => onView("week")}
          className={view === Views.WEEK ? "is-active" : ""}
        >
          Semana
        </button>
        <button
          type="button"
          onClick={() => onView("day")}
          className={view === Views.DAY ? "is-active" : ""}
        >
          Dia
        </button>
      </div>
    </div>
  );
}

export function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    api
      .get<EventFromApi[]>("/events")
      .then((res) => {
        const mapped = res.data.map((event) => ({
          id: event.id,
          title: event.title,
          start: new Date(event.startTime),
          end: new Date(event.endTime),
          isTimeBlock: Boolean(event.taskId),
        }));
        setEvents(mapped);
      })
      .catch(() => toast.error("Erro ao carregar eventos"))
      .finally(() => setLoading(false));
  }, []);

  const messages = useMemo(
    () => ({
      date: "Data",
      time: "Hora",
      event: "Evento",
      allDay: "Dia inteiro",
      week: "Semana",
      work_week: "Semana útil",
      day: "Dia",
      month: "Mês",
      previous: "Anterior",
      next: "Próximo",
      yesterday: "Ontem",
      tomorrow: "Amanhã",
      today: "Hoje",
      agenda: "Agenda",
      noEventsInRange: "Sem eventos neste período.",
      showMore: (total: number) => `+${total} mais`,
    }),
    [],
  );

  const eventStyleGetter: EventPropGetter<CalendarEvent> = (event) => ({
    className: event.isTimeBlock ? "arch-event-timeblock" : "arch-event-generic",
  });

  return (
    <div className="mx-auto flex h-full max-w-350 flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1 rounded-full bg-linear-to-b from-arcane to-arcane/20" />
        <h1 className="font-heading text-2xl font-bold tracking-wider text-foreground">
          Calendário
        </h1>
      </div>

      <div className="arch-calendar flex-1 overflow-hidden rounded-xl border border-border/60 bg-card/60 p-3 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.8)]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-relic">Carregando eventos...</div>
        ) : (
          <BigCalendar
            localizer={localizer}
            culture="pt-BR"
            events={events}
            view={view}
            date={date}
            onView={setView}
            onNavigate={setDate}
            startAccessor="start"
            endAccessor="end"
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            step={60}
            timeslots={1}
            messages={messages}
            popup
            components={{
              toolbar: CalendarToolbar,
            }}
            eventPropGetter={eventStyleGetter}
          />
        )}
      </div>
    </div>
  );
}
