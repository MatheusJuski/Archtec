import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  ListTodo,
  Lock,
  MapPin,
  Pencil,
  Repeat,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CalendarSourcesDialog } from "@/components/CalendarSourcesDialog";
import { allDayToLocalDate, localDateToAllDayIso } from "@/lib/calendar-dates";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
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

type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

interface EventSource {
  id: string;
  name: string;
  color: string | null;
  type: "ICS_URL" | "ICS_FILE";
}

interface EventFromApi {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  isRecurring: boolean;
  recurrenceFrequency: RecurrenceFrequency | null;
  taskId: string | null;
  noteId: string | null;
  task: { id: string; title: string } | null;
  note: { id: string; title: string } | null;
  calendarSource: EventSource | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  isRecurring: boolean;
  recurrenceFrequency: RecurrenceFrequency | null;
  isTimeBlock: boolean;
  noteId: string | null;
  task: { id: string; title: string } | null;
  note: { id: string; title: string } | null;
  source: EventSource | null;
}

const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  DAILY: "Diária",
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  YEARLY: "Anual",
};

/** Eventos de calendários assinados por link são atualizados pelo Google/Outlook: só leitura aqui. */
function isReadOnlyEvent(event: CalendarEvent) {
  return event.source?.type === "ICS_URL";
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
    location: z.string().optional(),
    noteId: z.string().optional(),
    allDay: z.boolean().optional(),
    startDate: z.string().min(1, "Data inicial é obrigatória"),
    startTime: z.string(),
    endDate: z.string().min(1, "Data final é obrigatória"),
    endTime: z.string(),
    isRecurring: z.boolean().optional(),
    recurrenceFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(),
  })
  .refine((data) => {
    const range = buildRangeFromValues(data);
    return range !== null && range.end > range.start;
  }, {
    message: "O término deve ser posterior ao início",
    path: ["endTime"],
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

/**
 * Converte o formulário no intervalo do evento. Em "dia inteiro" a data final
 * do formulário é inclusiva, e o fim vira a meia-noite do dia seguinte.
 */
function buildRangeFromValues(values: {
  allDay?: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}) {
  if (values.allDay) {
    const start = buildDateFromInputs(values.startDate, "00:00");
    const lastDay = buildDateFromInputs(values.endDate, "00:00");
    if (!start || !lastDay) return null;
    return { start, end: addDays(lastDay, 1) };
  }

  const start = buildDateFromInputs(values.startDate, values.startTime);
  const end = buildDateFromInputs(values.endDate, values.endTime);
  if (!start || !end) return null;
  return { start, end };
}

function formatEventWhen(event: CalendarEvent) {
  const dayFormat = "EEEE, d 'de' MMMM 'de' yyyy";
  if (event.allDay) {
    const lastDay = addDays(event.end, -1);
    const first = format(event.start, dayFormat, { locale: ptBR });
    if (lastDay <= event.start) return `${capitalizeLabel(first)} · Dia inteiro`;
    return `${capitalizeLabel(first)} até ${format(lastDay, dayFormat, { locale: ptBR })} · Dia inteiro`;
  }

  const sameDay = startOfDay(event.start).getTime() === startOfDay(event.end).getTime();
  const startLabel = format(event.start, `${dayFormat}, HH:mm`, { locale: ptBR });
  const endLabel = sameDay
    ? format(event.end, "HH:mm", { locale: ptBR })
    : format(event.end, `${dayFormat}, HH:mm`, { locale: ptBR });
  return `${capitalizeLabel(startLabel)} – ${endLabel}`;
}

function mapEventFromApi(event: EventFromApi): CalendarEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    start: event.allDay ? allDayToLocalDate(event.startTime) : new Date(event.startTime),
    end: event.allDay ? allDayToLocalDate(event.endTime) : new Date(event.endTime),
    allDay: event.allDay,
    isRecurring: event.isRecurring,
    recurrenceFrequency: event.recurrenceFrequency,
    isTimeBlock: Boolean(event.taskId),
    noteId: event.noteId,
    task: event.task,
    note: event.note,
    source: event.calendarSource,
  };
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
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isSourcesDialogOpen, setIsSourcesDialogOpen] = useState(false);
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
      location: "",
      noteId: "",
      allDay: false,
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
    setEvents(res.data.map(mapEventFromApi));
  }, []);

  useEffect(() => {
    fetchEvents()
      .catch(() => toast.error("Erro ao carregar eventos"))
      .finally(() => setLoading(false));
  }, [fetchEvents]);

  // Atualiza calendários assinados por link em segundo plano; recarrega se algo mudou.
  useEffect(() => {
    api
      .post<{ synced: number; failed: number }>("/calendar-sources/sync")
      .then((res) => {
        if (res.data.synced > 0) void fetchEvents();
        if (res.data.failed > 0) {
          toast.error("Algum calendário externo não sincronizou. Veja em “Calendários externos”.");
        }
      })
      .catch(() => {});
  }, [fetchEvents]);

  const isAllDayForm = Boolean(form.watch("allDay"));
  // Ao editar um evento antigo (ex.: importado), o limite nativo do <input type="date"> impediria salvar.
  const dateMin = editingEvent ? undefined : eventWindow.minDate;
  const dateMax = editingEvent ? undefined : eventWindow.maxDate;

  const localEventCount = useMemo(() => events.filter((event) => !event.source).length, [events]);

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

  function handleDragCancel() {
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
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao criar timeblock da tarefa"));
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
    // No mês, clicar num dia sugere evento com hora; na faixa "dia inteiro" da semana/dia, sugere dia inteiro.
    const isAllDaySlot =
      view !== Views.MONTH &&
      end > start &&
      start.getTime() === startOfDay(start).getTime() &&
      end.getTime() === startOfDay(end).getTime();
    const allDayLastDay = dateToFormParts(addDays(end, -1)).date;

    setEditingEvent(null);
    form.reset({
      title: "",
      description: "",
      location: "",
      noteId: "",
      allDay: isAllDaySlot,
      startDate: startParts.date,
      startTime: isAllDaySlot ? "09:00" : startParts.time,
      endDate: isAllDaySlot ? allDayLastDay : endParts.date,
      endTime: isAllDaySlot ? "10:00" : endParts.time,
      isRecurring: false,
      recurrenceFrequency: "WEEKLY",
    });
    setIsCreateDialogOpen(true);
  }

  function openEditEvent(event: CalendarEvent) {
    const startParts = dateToFormParts(event.start);
    const endParts = dateToFormParts(event.allDay ? addDays(event.end, -1) : event.end);

    setEditingEvent(event);
    form.reset({
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      noteId: event.noteId ?? "",
      allDay: event.allDay,
      startDate: startParts.date,
      startTime: event.allDay ? "09:00" : startParts.time,
      endDate: endParts.date,
      endTime: event.allDay ? "10:00" : endParts.time,
      isRecurring: event.isRecurring,
      recurrenceFrequency: event.recurrenceFrequency ?? "WEEKLY",
    });
    setSelectedEvent(null);
    setIsCreateDialogOpen(true);
  }

  async function onSubmitEvent(values: CreateEventValues) {
    const range = buildRangeFromValues(values);
    if (!range || range.end <= range.start) {
      toast.error("O término deve ser posterior ao início");
      return;
    }

    const { start, end } = range;
    const timesChanged =
      !editingEvent ||
      editingEvent.allDay !== Boolean(values.allDay) ||
      editingEvent.start.getTime() !== start.getTime() ||
      editingEvent.end.getTime() !== end.getTime();

    // Eventos antigos (ex.: importados) podem ter título/descrição editados sem mexer no horário.
    if (timesChanged) {
      const { minAllowed, maxAllowed } = getEventWindow();
      if (start < minAllowed || start > maxAllowed || end < minAllowed || end > maxAllowed) {
        toast.error(`Use um período entre 1 dia no passado e ${EVENT_FUTURE_LIMIT_YEARS} anos no futuro`);
        return;
      }
    }

    const allDay = Boolean(values.allDay);
    const payload = {
      title: values.title,
      description: values.description?.trim() ?? "",
      location: values.location?.trim() ?? "",
      allDay,
      startTime: allDay ? localDateToAllDayIso(start) : start.toISOString(),
      endTime: allDay ? localDateToAllDayIso(end) : end.toISOString(),
      isRecurring: Boolean(values.isRecurring),
      recurrenceFrequency: values.isRecurring ? values.recurrenceFrequency : undefined,
    };

    setIsSaving(true);
    try {
      if (editingEvent) {
        await api.patch(`/events/${editingEvent.id}`, {
          ...payload,
          noteId: values.noteId?.trim() || null,
        });
      } else {
        await api.post("/events", {
          ...payload,
          description: payload.description || undefined,
          location: payload.location || undefined,
          noteId: values.noteId?.trim() || undefined,
        });
      }

      await fetchEvents();
      setIsCreateDialogOpen(false);
      toast.success(editingEvent ? "Evento atualizado" : "Evento criado com sucesso");
      setEditingEvent(null);
      form.reset();
    } catch (error) {
      toast.error(getApiErrorMessage(error, editingEvent ? "Erro ao salvar evento" : "Erro ao criar evento"));
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeleteEvent(event: CalendarEvent) {
    setSelectedEvent(null);
    setPendingDelete({ kind: "one", event });
  }

  async function performDeleteEvent(event: CalendarEvent) {
    setIsSaving(true);
    try {
      await api.delete(`/events/${event.id}`);
      await fetchEvents();
      toast.success("Evento excluído");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao excluir evento"));
    } finally {
      setIsSaving(false);
      setPendingDelete(null);
    }
  }

  async function handleDeleteAllEvents() {
    if (localEventCount === 0) {
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

  const eventStyleGetter: EventPropGetter<CalendarEvent> = (event) => {
    if (event.source) {
      return {
        className: "arch-event-external",
        style: { "--event-color": event.source.color ?? "#7c5cff" } as React.CSSProperties,
      };
    }
    return {
      className: event.isTimeBlock ? "arch-event-timeblock" : "arch-event-generic",
    };
  };

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
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setIsSourcesDialogOpen(true)}>
                <CalendarDays className="size-4" />
                Calendários externos
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDeleteAllEvents}
                disabled={isSaving || localEventCount === 0}
                title="Remove os eventos criados no Archtec. Calendários externos são removidos em “Calendários externos”."
              >
                Limpar eventos
              </Button>
            </div>
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
                  allDayAccessor="allDay"
                  views={[Views.MONTH, Views.WEEK, Views.DAY]}
                  step={CALENDAR_STEP_MINUTES}
                  timeslots={CALENDAR_TIMESLOTS}
                  messages={messages}
                  popup
                  selectable
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={setSelectedEvent}
                  components={{
                    toolbar: CalendarToolbar,
                  }}
                  eventPropGetter={eventStyleGetter}
                />

                <Dialog
                  open={selectedEvent !== null}
                  onOpenChange={(open) => !open && setSelectedEvent(null)}
                >
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    {selectedEvent ? (
                      <>
                        <DialogHeader>
                          <span
                            className="label-tech inline-flex items-center gap-1.5 text-muted-foreground"
                          >
                            <span
                              aria-hidden
                              className="inline-block size-2.5 border border-ink"
                              style={{
                                background: selectedEvent.source
                                  ? (selectedEvent.source.color ?? "#7c5cff")
                                  : selectedEvent.isTimeBlock
                                    ? "var(--success)"
                                    : "var(--brand)",
                              }}
                            />
                            {selectedEvent.source
                              ? selectedEvent.source.name
                              : selectedEvent.isTimeBlock
                                ? "Bloco de tempo"
                                : "Evento"}
                          </span>
                          <DialogTitle className="wrap-break-word pr-6">{selectedEvent.title}</DialogTitle>
                          <DialogDescription className="flex items-start gap-2">
                            <Clock className="mt-0.5 size-4 shrink-0" />
                            <span>{formatEventWhen(selectedEvent)}</span>
                          </DialogDescription>
                        </DialogHeader>

                        <dl className="space-y-3 text-sm">
                          {selectedEvent.location ? (
                            <div className="flex items-start gap-2">
                              <dt className="sr-only">Local</dt>
                              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                              <dd className="wrap-break-word">{selectedEvent.location}</dd>
                            </div>
                          ) : null}

                          {selectedEvent.isRecurring && selectedEvent.recurrenceFrequency ? (
                            <div className="flex items-start gap-2">
                              <dt className="sr-only">Recorrência</dt>
                              <Repeat className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                              <dd>Repete: {RECURRENCE_LABELS[selectedEvent.recurrenceFrequency]}</dd>
                            </div>
                          ) : null}

                          {selectedEvent.task ? (
                            <div className="flex items-start gap-2">
                              <dt className="sr-only">Tarefa</dt>
                              <ListTodo className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                              <dd>
                                <Link to="/tasks" className="underline underline-offset-2 hover:text-brand">
                                  {selectedEvent.task.title}
                                </Link>
                              </dd>
                            </div>
                          ) : null}

                          {selectedEvent.note ? (
                            <div className="flex items-start gap-2">
                              <dt className="sr-only">Nota</dt>
                              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                              <dd>
                                <Link
                                  to={`/notes/${selectedEvent.note.id}`}
                                  className="underline underline-offset-2 hover:text-brand"
                                >
                                  {selectedEvent.note.title?.trim() || "Sem título"}
                                </Link>
                              </dd>
                            </div>
                          ) : null}

                          <div>
                            <dt className="label-tech mb-1 text-muted-foreground">Descrição</dt>
                            <dd className="max-h-64 overflow-y-auto whitespace-pre-wrap wrap-break-word border border-line bg-surface-1/40 px-3 py-2">
                              {selectedEvent.description?.trim() || (
                                <span className="text-muted-foreground">Sem descrição.</span>
                              )}
                            </dd>
                          </div>

                          {isReadOnlyEvent(selectedEvent) ? (
                            <p className="flex items-start gap-2 text-xs text-muted-foreground">
                              <Lock className="mt-0.5 size-3.5 shrink-0" />
                              Sincronizado por link de “{selectedEvent.source?.name}”. Para alterar, edite no
                              Google/Outlook — a mudança aparece aqui na próxima sincronização.
                            </p>
                          ) : null}
                        </dl>

                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setSelectedEvent(null)}>
                            Fechar
                          </Button>
                          {!isReadOnlyEvent(selectedEvent) ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleDeleteEvent(selectedEvent)}
                                disabled={isSaving}
                              >
                                <Trash2 className="size-4" />
                                Excluir
                              </Button>
                              <Button type="button" onClick={() => openEditEvent(selectedEvent)}>
                                <Pencil className="size-4" />
                                Editar
                              </Button>
                            </>
                          ) : null}
                        </DialogFooter>
                      </>
                    ) : null}
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={isCreateDialogOpen}
                  onOpenChange={(open) => {
                    setIsCreateDialogOpen(open);
                    if (!open) setEditingEvent(null);
                  }}
                >
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingEvent ? "Editar evento" : "Novo evento"}</DialogTitle>
                      <DialogDescription>
                        {editingEvent
                          ? "Altere os dados do evento e salve."
                          : "Preencha os dados para criar um evento no calendário."}
                      </DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmitEvent)} className="space-y-4">
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
                                <textarea
                                  rows={3}
                                  placeholder="Detalhes do evento"
                                  className="flex min-h-18 w-full resize-y border border-input bg-card px-3 py-2 text-base transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-ink/50 focus-visible:border-ink focus-visible:shadow-[2px_2px_0_0_var(--brand)] focus-visible:outline-none md:text-sm"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Local</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Sala 2 ou link da reunião" {...field} />
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

                        <FormField
                          control={form.control}
                          name="allDay"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <label className="flex h-10 cursor-pointer items-center gap-2.5 border border-input bg-card px-3 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(field.value)}
                                    onChange={(event) => field.onChange(event.target.checked)}
                                  />
                                  Dia inteiro
                                </label>
                              </FormControl>
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
                                  <div className={isAllDayForm ? "grid gap-2" : "grid grid-cols-2 gap-2"}>
                                    <Input type="date" min={dateMin} max={dateMax} {...field} />
                                    {!isAllDayForm ? (
                                      <FormField
                                        control={form.control}
                                        name="startTime"
                                        render={({ field: timeField }) => (
                                          <Input type="time" step={900} {...timeField} />
                                        )}
                                      />
                                    ) : null}
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
                                  <div className={isAllDayForm ? "grid gap-2" : "grid grid-cols-2 gap-2"}>
                                    <Input type="date" min={dateMin} max={dateMax} {...field} />
                                    {!isAllDayForm ? (
                                      <FormField
                                        control={form.control}
                                        name="endTime"
                                        render={({ field: timeField }) => (
                                          <Input type="time" step={900} {...timeField} />
                                        )}
                                      />
                                    ) : null}
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

        <CalendarSourcesDialog
          open={isSourcesDialogOpen}
          onOpenChange={setIsSourcesDialogOpen}
          onEventsChanged={() => {
            fetchEvents().catch(() => toast.error("Erro ao recarregar eventos"));
          }}
        />

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
