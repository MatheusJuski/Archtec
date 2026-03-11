import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  Views,
  View,
  EventPropGetter,
  ToolbarProps,
  SlotInfo,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const createEventSchema = z
  .object({
    title: z.string().trim().min(1, "Título é obrigatório"),
    startTime: z.string().min(1, "Início é obrigatório"),
    endTime: z.string().min(1, "Término é obrigatório"),
  })
  .refine((data) => {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;
  }, {
    message: "A hora de término deve ser posterior ao início",
    path: ["endTime"],
  });

type CreateEventValues = z.infer<typeof createEventSchema>;

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

function toDateTimeLocal(date: Date) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
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
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(new Date());

  const form = useForm<CreateEventValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: "",
      startTime: "",
      endTime: "",
    },
  });

  const fetchEvents = useCallback(async () => {
    const res = await api.get<EventFromApi[]>("/events");
    const mapped = res.data.map((event) => ({
      id: event.id,
      title: event.title,
      start: new Date(event.startTime),
      end: new Date(event.endTime),
      isTimeBlock: Boolean(event.taskId),
    }));
    setEvents(mapped);
  }, []);

  useEffect(() => {
    fetchEvents()
      .catch(() => toast.error("Erro ao carregar eventos"))
      .finally(() => setLoading(false));
  }, [fetchEvents]);

  function handleSelectSlot(slotInfo: SlotInfo) {
    const start = slotInfo.start instanceof Date ? slotInfo.start : new Date(slotInfo.start);
    const end = slotInfo.end instanceof Date ? slotInfo.end : new Date(slotInfo.end);

    let normalizedEnd = end;
    if (view === Views.MONTH) {
      normalizedEnd = new Date(start.getTime() + 60 * 60 * 1000);
    }

    form.reset({
      title: "",
      startTime: toDateTimeLocal(start),
      endTime: toDateTimeLocal(normalizedEnd),
    });
    setIsCreateDialogOpen(true);
  }

  async function onCreateEvent(values: CreateEventValues) {
    setIsSaving(true);
    try {
      await api.post("/events", {
        title: values.title,
        startTime: new Date(values.startTime).toISOString(),
        endTime: new Date(values.endTime).toISOString(),
      });

      await fetchEvents();
      setIsCreateDialogOpen(false);
      form.reset();
      toast.success("Evento criado com sucesso");
    } catch (error: any) {
      const message = error?.response?.data?.message;
      toast.error(Array.isArray(message) ? message[0] : message || "Erro ao criar evento");
    } finally {
      setIsSaving(false);
    }
  }

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
          <>
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
              selectable
              onSelectSlot={handleSelectSlot}
              components={{
                toolbar: CalendarToolbar,
              }}
              eventPropGetter={eventStyleGetter}
            />

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogContent className="border-border bg-card/95 text-foreground backdrop-blur">
                <DialogHeader>
                  <DialogTitle className="font-heading tracking-wide">Novo Evento</DialogTitle>
                  <DialogDescription>
                    Preencha os dados para criar um evento no calendário.
                  </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onCreateEvent)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Título</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Revisão semanal" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Início</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Término</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={isSaving}>
                        {isSaving ? "Salvando..." : "Salvar evento"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
}
