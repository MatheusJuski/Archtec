import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragCancelEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  Views,
  View,
  EventPropGetter,
  ToolbarProps,
  SlotInfo,
} from "react-big-calendar";
import {
  addDays,
  format,
  getDay,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
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
  description: string | null;
  startTime: string;
  endTime: string;
  taskId: string | null;
  noteId: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  isTimeBlock: boolean;
  noteId: string | null;
}

interface NoteFromApi {
  id: string;
  title: string;
}

interface TaskFromApi {
  id: string;
  title: string;
  parentId: string | null;
  children?: TaskFromApi[];
}

interface FlatTask {
  id: string;
  title: string;
  level: number;
}

const EVENT_PAST_GRACE_DAYS = 1;
const EVENT_FUTURE_LIMIT_YEARS = 10;

function getEventWindow() {
  const now = new Date();
  const minAllowed = new Date(now);
  minAllowed.setDate(minAllowed.getDate() - EVENT_PAST_GRACE_DAYS);

  const maxAllowed = new Date(now);
  maxAllowed.setFullYear(maxAllowed.getFullYear() + EVENT_FUTURE_LIMIT_YEARS);

  return { minAllowed, maxAllowed };
}

const createEventSchema = z
  .object({
    title: z.string().trim().min(1, "Título é obrigatório"),
    description: z.string().optional(),
    noteId: z.string().optional(),
    startDate: z.string().min(1, "Data inicial é obrigatória"),
    startTime: z.string().min(1, "Hora inicial é obrigatória"),
    endDate: z.string().min(1, "Data final é obrigatória"),
    endTime: z.string().min(1, "Hora final é obrigatória"),
    isRecurring: z.boolean().optional(),
    recurrenceFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(),
  })
  .refine((data) => {
    const start = buildDateFromInputs(data.startDate, data.startTime);
    const end = buildDateFromInputs(data.endDate, data.endTime);

    return start !== null && end !== null && end > start;
  }, {
    message: "A hora de término deve ser posterior ao início",
    path: ["endTime"],
  })
  .refine((data) => {
    const start = buildDateFromInputs(data.startDate, data.startTime);
    const end = buildDateFromInputs(data.endDate, data.endTime);
    if (!start || !end) return false;

    const { minAllowed, maxAllowed } = getEventWindow();
    return start >= minAllowed && start <= maxAllowed && end >= minAllowed && end <= maxAllowed;
  }, {
    message: `Eventos só podem ficar entre 1 dia no passado e ${EVENT_FUTURE_LIMIT_YEARS} anos no futuro`,
    path: ["startDate"],
  })
  .refine((data) => {
    if (!data.isRecurring) return true;
    return Boolean(data.recurrenceFrequency);
  }, {
    message: "Selecione a frequência da recorrência",
    path: ["recurrenceFrequency"],
  });

type CreateEventValues = z.infer<typeof createEventSchema>;

const locales = {
  "pt-BR": ptBR,
};

const CALENDAR_STEP_MINUTES = 60;
const CALENDAR_TIMESLOTS = 1;

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

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

function buildDateFromInputs(dateInput: string, timeInput: string) {
  const [year, month, day] = dateInput.split("-").map(Number);
  const [hour, minute] = timeInput.split(":").map(Number);

  if ([year, month, day, hour, minute].some((v) => Number.isNaN(v))) {
    return null;
  }

  const built = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    built.getFullYear() !== year ||
    built.getMonth() !== month - 1 ||
    built.getDate() !== day
  ) {
    return null;
  }

  return built;
}

function dateToFormParts(date: Date) {
  return {
    date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
}

function extractApiErrorMessage(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message[0] ?? fallback;
  if (typeof message === "string" && message.trim().length > 0) return message;
  return fallback;
}

function flattenTasks(tasks: TaskFromApi[], level = 0): FlatTask[] {
  return tasks.flatMap((task) => [
    { id: task.id, title: task.title, level },
    ...flattenTasks(task.children ?? [], level + 1),
  ]);
}

function DraggableTask({ task }: { task: FlatTask }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { taskId: task.id, title: task.title },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={`arch-task-chip ${isDragging ? "is-dragging" : ""}`}
      {...listeners}
      {...attributes}
      title="Arraste para o calendário"
    >
      <span
        className="arch-task-chip__indent"
        style={{ marginLeft: `${task.level * 0.75}rem` }}
      />
      <span className="arch-task-chip__title">{task.title}</span>
    </button>
  );
}

function CalendarToolbar({ label, onNavigate, onView, view }: ToolbarProps<CalendarEvent, object>) {
  return (
    <div className="arch-toolbar">
      <div className="arch-toolbar__nav">
        <button type="button" onClick={() => onNavigate("TODAY")}>Hoje</button>
        <button type="button" onClick={() => onNavigate("PREV")} aria-label="Anterior"><ChevronLeft className="size-3.5" /></button>
        <button type="button" onClick={() => onNavigate("NEXT")} aria-label="Próximo"><ChevronRight className="size-3.5" /></button>
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
  const [pendingDelete, setPendingDelete] = useState<
    { kind: "one"; event: CalendarEvent } | { kind: "all" } | null
  >(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<FlatTask[]>([]);
  const [notes, setNotes] = useState<NoteFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeDragTask, setActiveDragTask] = useState<FlatTask | null>(null);
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const { isOver, setNodeRef: setCalendarDropRef } = useDroppable({
    id: "calendar-grid",
  });
  const calendarDropContainerRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const form = useForm<CreateEventValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: "",
      description: "",
      noteId: "",
      startDate: "",
      startTime: "09:00",
      endDate: "",
      endTime: "10:00",
      isRecurring: false,
      recurrenceFrequency: "WEEKLY",
    },
  });

  const eventWindow = useMemo(() => {
    const { minAllowed, maxAllowed } = getEventWindow();
    return {
      minDate: dateToFormParts(minAllowed).date,
      maxDate: dateToFormParts(maxAllowed).date,
    };
  }, []);

  const fetchEvents = useCallback(async () => {
    const res = await api.get<EventFromApi[]>("/events");
    const mapped = res.data.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      start: new Date(event.startTime),
      end: new Date(event.endTime),
      isTimeBlock: Boolean(event.taskId),
      noteId: event.noteId,
    }));
    setEvents(mapped);
  }, []);

  useEffect(() => {
    fetchEvents()
      .catch(() => toast.error("Erro ao carregar eventos"))
      .finally(() => setLoading(false));
  }, [fetchEvents]);

  useEffect(() => {
    api
      .get<TaskFromApi[]>("/tasks", { params: { tree: "true" } })
      .then((res) => setTasks(flattenTasks(res.data)))
      .catch(() => toast.error("Erro ao carregar tarefas"));
  }, []);

  useEffect(() => {
    api
      .get<NoteFromApi[]>("/notes")
      .then((res) => setNotes(res.data))
      .catch(() => toast.error("Erro ao carregar notas"));
  }, []);

  function calculateDropDate(viewMode: View, baseDate: Date, x: number, y: number) {
    if (viewMode === Views.MONTH) {
      const dayCells = Array.from(document.querySelectorAll<HTMLElement>(".arch-calendar .rbc-day-bg"));
      if (!dayCells.length) return null;

      const index = dayCells.findIndex((cell) => {
        const rect = cell.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      });
      if (index < 0) return null;

      const firstVisible = startOfWeek(startOfMonth(baseDate), { locale: ptBR });
      const targetDate = addDays(firstVisible, index);
      targetDate.setHours(9, 0, 0, 0);
      return targetDate;
    }

    const content = document.querySelector<HTMLElement>(".arch-calendar .rbc-time-content");
    if (!content) return null;

    const dayColumns = Array.from(
      document.querySelectorAll<HTMLElement>(".arch-calendar .rbc-time-content .rbc-day-slot"),
    );
    if (!dayColumns.length) return null;

    const rawColumn = dayColumns.findIndex((column) => {
      const rect = column.getBoundingClientRect();
      return x >= rect.left && x < rect.right;
    });

    const columnIndex = rawColumn >= 0 ? rawColumn : 0;

    const activeColumn = dayColumns[columnIndex];
    const columnRect = activeColumn.getBoundingClientRect();

    const clampedY = Math.min(Math.max(y, columnRect.top), columnRect.bottom - 1);
    const relativeY = clampedY - columnRect.top + content.scrollTop;
    const fullDayHeight = activeColumn.scrollHeight || content.scrollHeight || 1;
    const minutesPerSlot = CALENDAR_STEP_MINUTES / CALENDAR_TIMESLOTS;

    const firstSlot = document.querySelector<HTMLElement>(".arch-calendar .rbc-time-slot");
    const slotHeight = firstSlot?.getBoundingClientRect().height ?? 0;

    let snappedMinutes: number;
    if (slotHeight > 0) {
      const slotIndex = Math.floor(relativeY / slotHeight);
      snappedMinutes = slotIndex * minutesPerSlot;
    } else {
      const proportionalMinutes = (relativeY / fullDayHeight) * 24 * 60;
      snappedMinutes = Math.floor(proportionalMinutes / minutesPerSlot) * minutesPerSlot;
    }

    const normalizedMinutes = Math.max(0, Math.min(24 * 60 - minutesPerSlot, snappedMinutes));

    const baseDay =
      viewMode === Views.WEEK
        ? addDays(startOfWeek(baseDate, { locale: ptBR }), columnIndex)
        : baseDate;

    const result = startOfDay(baseDay);
    result.setMinutes(normalizedMinutes, 0, 0);
    return result;
  }

  async function createEventFromTaskDrop(task: FlatTask, start: Date) {
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    await api.post("/events", {
      title: task.title,
      taskId: task.id,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });

    await fetchEvents();
  }

  function getDropCenter(event: DragEndEvent) {
    const translated = event.active.rect.current.translated;
    if (translated) {
      return {
        x: translated.left + translated.width / 2,
        y: translated.top + translated.height / 2,
      };
    }

    const initial = event.active.rect.current.initial;
    if (initial) {
      return {
        x: initial.left + event.delta.x + initial.width / 2,
        y: initial.top + event.delta.y + initial.height / 2,
      };
    }

    const fallbackRect = event.over?.rect;
    if (fallbackRect) {
      return {
        x: fallbackRect.left + fallbackRect.width / 2,
        y: fallbackRect.top + fallbackRect.height / 2,
      };
    }

    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    const taskId = (event.active.data.current?.taskId as string | undefined) ?? "";
    const title = (event.active.data.current?.title as string | undefined) ?? "";
    if (!taskId || !title) {
      setActiveDragTask(null);
      return;
    }

    setActiveDragTask({
      id: taskId,
      title,
      level: 0,
    });
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveDragTask(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const draggedTask = activeDragTask;
    setActiveDragTask(null);

    if (!draggedTask) return;
    const dropCenter = getDropCenter(event);
    if (!dropCenter) {
      toast.error("Não foi possível determinar o horário do drop");
      return;
    }

    const calendarContainer = calendarDropContainerRef.current;
    if (!calendarContainer) return;

    const calendarRect = calendarContainer.getBoundingClientRect();
    const isInsideCalendar =
      dropCenter.x >= calendarRect.left &&
      dropCenter.x <= calendarRect.right &&
      dropCenter.y >= calendarRect.top &&
      dropCenter.y <= calendarRect.bottom;

    if (!isInsideCalendar) return;

    const start = calculateDropDate(view, date, dropCenter.x, dropCenter.y);
    if (!start) {
      toast.error("Não foi possível determinar o horário do drop");
      return;
    }

    setIsSaving(true);
    try {
      await createEventFromTaskDrop(draggedTask, start);
      toast.success(`Timeblock criado para: ${draggedTask.title}`);
    } catch (error: any) {
      toast.error(extractApiErrorMessage(error, "Erro ao criar timeblock da tarefa"));
    } finally {
      setIsSaving(false);
    }
  }

  function handleSelectSlot(slotInfo: SlotInfo) {
    const start = slotInfo.start instanceof Date ? slotInfo.start : new Date(slotInfo.start);
    const end = slotInfo.end instanceof Date ? slotInfo.end : new Date(slotInfo.end);

    let normalizedEnd = end;
    if (view === Views.MONTH) {
      normalizedEnd = new Date(start.getTime() + 60 * 60 * 1000);
    }

    const startParts = dateToFormParts(start);
    const endParts = dateToFormParts(normalizedEnd);

    form.reset({
      title: "",
      description: "",
      noteId: "",
      startDate: startParts.date,
      startTime: startParts.time,
      endDate: endParts.date,
      endTime: endParts.time,
      isRecurring: false,
      recurrenceFrequency: "WEEKLY",
    });
    setIsCreateDialogOpen(true);
  }

  async function onCreateEvent(values: CreateEventValues) {
    setIsSaving(true);
    try {
      const start = buildDateFromInputs(values.startDate, values.startTime);
      const end = buildDateFromInputs(values.endDate, values.endTime);
      const { minAllowed, maxAllowed } = getEventWindow();

      if (!start || !end || end <= start) {
        toast.error("A hora de término deve ser posterior ao início");
        return;
      }

      if (start < minAllowed || start > maxAllowed || end < minAllowed || end > maxAllowed) {
        toast.error(`Use um período entre 1 dia no passado e ${EVENT_FUTURE_LIMIT_YEARS} anos no futuro`);
        return;
      }

      await api.post("/events", {
        title: values.title,
        description: values.description?.trim() || undefined,
        noteId: values.noteId?.trim() || undefined,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        isRecurring: Boolean(values.isRecurring),
        recurrenceFrequency: values.isRecurring ? values.recurrenceFrequency : undefined,
      });

      await fetchEvents();
      setIsCreateDialogOpen(false);
      form.reset();
      toast.success("Evento criado com sucesso");
    } catch (error: any) {
      toast.error(extractApiErrorMessage(error, "Erro ao criar evento"));
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeleteEvent(event: CalendarEvent) {
    setPendingDelete({ kind: "one", event });
  }

  async function performDeleteEvent(event: CalendarEvent) {
    setIsSaving(true);
    try {
      await api.delete(`/events/${event.id}`);
      await fetchEvents();
      toast.success("Evento excluído");
    } catch {
      toast.error("Erro ao excluir evento");
    } finally {
      setIsSaving(false);
      setPendingDelete(null);
    }
  }

  async function handleDeleteAllEvents() {
    if (events.length === 0) {
      toast.message("Não há eventos para remover");
      return;
    }

    setPendingDelete({ kind: "all" });
  }

  async function performDeleteAllEvents() {
    setIsSaving(true);
    try {
      const res = await api.delete<{ deletedCount: number }>("/events");
      await fetchEvents();
      toast.success(`${res.data.deletedCount} evento(s) removido(s)`);
    } catch {
      toast.error("Erro ao limpar eventos");
    } finally {
      setIsSaving(false);
      setPendingDelete(null);
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

  const selectedTaskCount = tasks.length;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-450 flex-col px-5 py-8 md:px-10 md:py-12">
        <PageHeader
          eyebrow="04 / Calendário"
          title="Calendário"
          description="Arraste tarefas para a agenda para criar blocos de tempo."
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={handleDeleteAllEvents}
              disabled={isSaving || events.length === 0}
            >
              Limpar eventos
            </Button>
          }
        />

        <div className="arch-calendar-layout">
          <aside className="arch-task-sidebar">
            <div className="arch-task-sidebar__header">
              <h2 className="chip chip-offset">Tarefas</h2>
              <span className="label-tech tabular-nums text-muted-foreground">{String(selectedTaskCount).padStart(2, "0")}</span>
            </div>

            <div className="arch-task-sidebar__list">
              {tasks.length === 0 ? (
                <p className="hatch border border-dashed border-line px-3 py-6 text-center text-xs text-muted-foreground">Nenhuma tarefa para arrastar.</p>
              ) : (
                tasks.map((task) => <DraggableTask key={task.id} task={task} />)
              )}
            </div>
          </aside>

          <div
            ref={(node) => {
              setCalendarDropRef(node);
              calendarDropContainerRef.current = node;
            }}
            className={`arch-calendar flex-1 overflow-hidden ${isOver ? "arch-calendar--drop-over" : ""}`}
          >
            {loading ? (
              <Skeleton className="h-full min-h-[60vh] border border-line" />
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
                  step={CALENDAR_STEP_MINUTES}
                  timeslots={CALENDAR_TIMESLOTS}
                  messages={messages}
                  popup
                  selectable
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={handleDeleteEvent}
                  components={{
                    toolbar: CalendarToolbar,
                  }}
                  eventPropGetter={eventStyleGetter}
                />

                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Novo evento</DialogTitle>
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

                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Descrição</FormLabel>
                              <FormControl>
                                <Input placeholder="Detalhes do evento" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="noteId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Referenciar nota</FormLabel>
                              <FormControl>
                                <select
                                  className="arch-picker h-10 w-full"
                                  value={field.value || ""}
                                  onChange={(event) => field.onChange(event.target.value)}
                                >
                                  <option value="">Sem nota vinculada</option>
                                  {notes.map((note) => (
                                    <option key={note.id} value={note.id}>
                                      {note.title?.trim() || "Sem título"}
                                    </option>
                                  ))}
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid gap-4 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="startDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Início</FormLabel>
                                <FormControl>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Input type="date" min={eventWindow.minDate} max={eventWindow.maxDate} {...field} />
                                    <FormField
                                      control={form.control}
                                      name="startTime"
                                      render={({ field: timeField }) => (
                                        <Input type="time" step={900} {...timeField} />
                                      )}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="endDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Término</FormLabel>
                                <FormControl>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Input type="date" min={eventWindow.minDate} max={eventWindow.maxDate} {...field} />
                                    <FormField
                                      control={form.control}
                                      name="endTime"
                                      render={({ field: timeField }) => (
                                        <Input type="time" step={900} {...timeField} />
                                      )}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="isRecurring"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Recorrência</FormLabel>
                                <FormControl>
                                  <label className="flex h-10 cursor-pointer items-center gap-2.5 border border-input bg-card px-3 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(field.value)}
                                      onChange={(event) => field.onChange(event.target.checked)}
                                    />
                                    Repetir automaticamente
                                  </label>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {form.watch("isRecurring") ? (
                            <FormField
                              control={form.control}
                              name="recurrenceFrequency"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Frequência</FormLabel>
                                  <FormControl>
                                    <select
                                      className="arch-picker h-10 w-full"
                                      value={field.value || "WEEKLY"}
                                      onChange={(event) => field.onChange(event.target.value)}
                                    >
                                      <option value="DAILY">Diária</option>
                                      <option value="WEEKLY">Semanal</option>
                                      <option value="MONTHLY">Mensal</option>
                                      <option value="YEARLY">Anual</option>
                                    </select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ) : (
                            <div />
                          )}
                        </div>

                        <p className="label-tech text-muted-foreground">
                          Janela permitida: de 1 dia atrás até {EVENT_FUTURE_LIMIT_YEARS} anos no futuro.
                        </p>

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

        <DragOverlay>
          {activeDragTask ? (
            <div className="arch-task-chip is-overlay">
              <span className="arch-task-chip__title">{activeDragTask.title}</span>
            </div>
          ) : null}
        </DragOverlay>

        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title={pendingDelete?.kind === "all" ? "Limpar todos os eventos?" : "Excluir evento?"}
          description={
            pendingDelete?.kind === "one"
              ? `"${pendingDelete.event.title}" será removido. Esta ação não pode ser desfeita.`
              : "Todos os eventos do calendário serão removidos. Esta ação não pode ser desfeita."
          }
          confirmLabel={pendingDelete?.kind === "all" ? "Limpar tudo" : "Excluir"}
          loading={isSaving}
          onConfirm={() => {
            if (pendingDelete?.kind === "one") void performDeleteEvent(pendingDelete.event);
            else if (pendingDelete?.kind === "all") void performDeleteAllEvents();
          }}
        />
      </div>
      </div>
    </DndContext>
  );
}
