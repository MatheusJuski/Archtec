import { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarClock, CheckSquare, FileText, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TodayWidget } from "@/components/TodayWidget";
import { PageHeader } from "@/components/ui/page-header";
import { ShaderBackdrop } from "@/components/shader/ShaderBackdrop";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { api } from "@/lib/api";
import { allDayToLocalDate } from "@/lib/calendar-dates";

interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
}

/** Evento de dia inteiro (possivelmente de vários dias) que cobre o dia informado. */
function allDayCovers(event: Event, day: Date) {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return allDayToLocalDate(event.startTime) <= dayStart && dayStart < allDayToLocalDate(event.endTime);
}

interface Task {
  id: string;
  title: string;
  dueDate: string | null;
}

interface TransactionsSummary {
  month: number;
  year: number;
  income: number;
  expense: number;
  balance: number;
}

interface HealthSummary {
  tasksOverdue: number;
  tasksDueToday: number;
  eventsToday: number;
  notesTotal: number;
  monthIncome: number;
  monthExpense: number;
  monthBalance: number;
  receivableOpen: number;
  payableOpen: number;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const ease = [0.22, 1, 0.36, 1] as const;

const capitalizeFirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

type Source = "events" | "tasks" | "summary" | "health";

const SOURCE_LABELS: Record<Source, string> = {
  events: "eventos",
  tasks: "tarefas",
  summary: "resumo financeiro",
  health: "indicadores",
};

interface DashboardData {
  key: number;
  events: Event[] | null;
  tasks: Task[] | null;
  summary: TransactionsSummary | null;
  health: HealthSummary | null;
  failed: Source[];
}

/** Carrega cada fonte de forma independente: uma falha não apaga as outras. */
async function loadDashboard(key: number): Promise<DashboardData> {
  const [eventsRes, tasksRes, summaryRes, healthRes] = await Promise.allSettled([
    api.get<Event[]>("/events"),
    api.get<Task[]>("/tasks"),
    api.get<TransactionsSummary>("/transactions/summary"),
    api.get<HealthSummary>("/finance/health-summary"),
  ]);

  const failed: Source[] = [];
  /** Resposta OK e no formato esperado; senão a fonte conta como falha (sem números falsos na tela). */
  const take = <T,>(res: PromiseSettledResult<{ data: T }>, source: Source, isValid: (data: unknown) => boolean): T | null => {
    if (res.status === "fulfilled" && isValid(res.value.data)) return res.value.data;
    console.error(`Falha ao carregar ${source}`, res.status === "rejected" ? res.reason : res.value.data);
    failed.push(source);
    return null;
  };

  const rawSummary = take(summaryRes, "summary", (d) => isRecord(d) && isNumeric(d.balance) && isNumeric(d.month));
  const rawHealth = take(healthRes, "health", (d) => isRecord(d) && isNumeric(d.tasksOverdue));

  return {
    key,
    events: take(eventsRes, "events", Array.isArray),
    tasks: take(tasksRes, "tasks", Array.isArray),
    summary: rawSummary && {
      month: rawSummary.month,
      year: rawSummary.year,
      income: Number(rawSummary.income),
      expense: Number(rawSummary.expense),
      balance: Number(rawSummary.balance),
    },
    health: rawHealth && {
      ...rawHealth,
      monthIncome: Number(rawHealth.monthIncome),
      monthExpense: Number(rawHealth.monthExpense),
      monthBalance: Number(rawHealth.monthBalance),
      receivableOpen: Number(rawHealth.receivableOpen),
      payableOpen: Number(rawHealth.payableOpen),
    },
    failed,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// A API serializa decimais do Prisma como string: "123.45" também vale
const isNumeric = (value: unknown) => value !== null && value !== "" && Number.isFinite(Number(value));

function isSameDay(dateStr: string | null | undefined, day: Date) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-6">
        <Skeleton className="h-72 border border-line" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 border border-line" />
          ))}
        </div>
      </div>
      <Skeleton className="h-96 border border-line" />
    </div>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Carregando enquanto o resultado em mãos não for o da tentativa atual
  const loading = data?.key !== reloadKey;

  useEffect(() => {
    let cancelled = false;
    loadDashboard(reloadKey).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const events = data?.events ?? null;
  const tasks = data?.tasks ?? null;
  const summary = data?.summary ?? null;
  const healthSummary = data?.health ?? null;
  const failed = data?.failed ?? [];

  const today = useMemo(() => new Date(), []);

  const todayEvents = useMemo(
    () =>
      (events ?? [])
        .filter((e) => (e.allDay ? allDayCovers(e, today) : isSameDay(e.startTime, today)))
        // Dia inteiro primeiro, depois por horário
        .sort((a, b) => Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) || new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .map((e) => ({
          id: e.id,
          title: e.title,
          time: e.allDay ? "Dia inteiro" : new Date(e.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        })),
    [events, today]
  );

  const todayTasks = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => isSameDay(t.dueDate, today))
        .map((t) => ({ id: t.id, title: t.title })),
    [tasks, today]
  );

  const financialSummary = summary ?? {
    month: today.getMonth() + 1,
    year: today.getFullYear(),
    income: 0,
    expense: 0,
    balance: 0,
  };

  // Se a API devolver mês/ano inválidos, cai no mês atual em vez de quebrar a tela
  const summaryMonth = new Date(financialSummary.year, financialSummary.month - 1, 1);
  const monthLabel = monthFormatter.format(Number.isNaN(summaryMonth.getTime()) ? today : summaryMonth);
  const isPositiveBalance = financialSummary.balance >= 0;

  const flow = financialSummary.income + financialSummary.expense;
  const incomeShare = flow > 0 ? (financialSummary.income / flow) * 100 : 50;

  // Sem dado não mostramos 0 (que pareceria real): mostramos "—"
  const UNAVAILABLE = "—";
  const money = (value: number | undefined, available: boolean) =>
    available && value !== undefined ? currencyFormatter.format(value) : UNAVAILABLE;
  const hasSummary = summary !== null;
  const hasHealth = healthSummary !== null;

  const stats = [
    { label: "Tarefas vencidas", value: hasHealth ? healthSummary.tasksOverdue : UNAVAILABLE, tone: (healthSummary?.tasksOverdue ?? 0) > 0 ? "danger" : "default", icon: <AlertTriangle /> },
    // Contagem local primeiro: o "hoje" do servidor está em UTC e diverge do fuso do usuário à noite
    { label: "Tarefas para hoje", value: tasks ? todayTasks.length : (healthSummary?.tasksDueToday ?? UNAVAILABLE), tone: "brand", icon: <CheckSquare /> },
    { label: "Eventos hoje", value: events ? todayEvents.length : (healthSummary?.eventsToday ?? UNAVAILABLE), tone: "default", icon: <CalendarClock /> },
    { label: "Notas totais", value: hasHealth ? healthSummary.notesTotal : UNAVAILABLE, tone: "default", icon: <FileText /> },
    { label: "A receber em aberto", value: money(healthSummary?.receivableOpen, hasHealth), tone: "success", icon: <ArrowDownLeft /> },
    { label: "A pagar em aberto", value: money(healthSummary?.payableOpen, hasHealth), tone: "signal", icon: <ArrowUpRight /> },
  ] as const;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
        <PageHeader
          eyebrow="01 / Hoje"
          title="Visão geral"
          description={capitalizeFirst(dayFormatter.format(today))}
        />

        {!loading && failed.length > 0 && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center gap-3 border border-destructive border-l-[3px] bg-destructive/5 px-4 py-3"
          >
            <AlertTriangle className="size-4 shrink-0 text-destructive" />
            <p className="min-w-0 flex-1 text-sm">
              {failed.length === 4
                ? "Não foi possível carregar o painel. Verifique sua conexão."
                : `Não foi possível carregar: ${failed.map((f) => SOURCE_LABELS[f]).join(", ")}. O restante está atualizado.`}
            </p>
            <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
              <RotateCw /> Tentar novamente
            </Button>
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid content-start gap-6">
              {/* Saldo em destaque */}
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease }}
                className="border border-ink shadow-[6px_6px_0_0_var(--ink)]"
              >
                <ShaderBackdrop forceDark className="min-h-64">
                  <div className="flex h-full min-h-64 flex-col justify-between gap-8 p-6 text-white md:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="chip bg-white text-black">Saldo atual</span>
                      <span className="label-tech text-white/75">{monthLabel}</span>
                    </div>
                    <div>
                      <p className="font-mono text-[clamp(2.25rem,6vw,4rem)] font-medium leading-none tracking-[-0.04em] tabular-nums">
                        {money(financialSummary.balance, hasSummary)}
                      </p>
                      <p className="mt-3 flex items-center gap-2 text-sm text-white/75">
                        <span className={!hasSummary ? "size-2 bg-white/50" : isPositiveBalance ? "size-2 bg-success" : "size-2 bg-destructive"} />
                        {!hasSummary
                          ? "Resumo financeiro indisponível no momento."
                          : isPositiveBalance
                            ? "No azul este mês."
                            : "Gastos acima das receitas este mês."}
                      </p>
                    </div>
                  </div>
                </ShaderBackdrop>

                {/* Régua de fluxo: receitas x despesas */}
                <div className="grid gap-4 border-t border-ink bg-card p-5 md:p-6">
                  <div className="flex h-2 w-full gap-1" aria-hidden>
                    <motion.span
                      className="h-full bg-success"
                      initial={{ width: 0 }}
                      animate={{ width: `${incomeShare}%` }}
                      transition={{ duration: 0.9, ease, delay: 0.2 }}
                    />
                    <span className="hatch hatch-signal h-full flex-1 border border-signal" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="label-tech flex items-center gap-2 text-muted-foreground">
                        <span className="size-2 bg-success" /> Receitas
                      </p>
                      <p className="mt-2 font-mono text-xl tabular-nums">{money(financialSummary.income, hasSummary)}</p>
                    </div>
                    <div className="text-right">
                      <p className="label-tech flex items-center justify-end gap-2 text-muted-foreground">
                        Despesas <span className="hatch hatch-signal size-2 border border-signal" />
                      </p>
                      <p className="mt-2 font-mono text-xl tabular-nums">{money(financialSummary.expense, hasSummary)}</p>
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* Indicadores */}
              <motion.div
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } } }}
              >
                {stats.map((stat) => (
                  <motion.div
                    key={stat.label}
                    variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease } } }}
                  >
                    <Stat label={stat.label} value={stat.value} tone={stat.tone} icon={stat.icon} className="h-full" />
                  </motion.div>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.1 }}
            >
              <TodayWidget events={todayEvents} tasks={todayTasks} unavailable={events === null || tasks === null} />
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
