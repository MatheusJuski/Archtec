import { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarClock, CheckSquare, FileText } from "lucide-react";
import { TodayWidget } from "@/components/TodayWidget";
import { PageHeader } from "@/components/ui/page-header";
import { ShaderBackdrop } from "@/components/shader/ShaderBackdrop";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { api } from "@/lib/api";

interface Event {
  id: string;
  title: string;
  start: string;
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
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<TransactionsSummary | null>(null);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/events"),
      api.get("/tasks"),
      api.get<TransactionsSummary>("/transactions/summary"),
      api.get<HealthSummary>("/finance/health-summary"),
    ])
      .then(([eventsRes, tasksRes, summaryRes, healthRes]) => {
        setEvents(eventsRes.data);
        setTasks(tasksRes.data);
        setSummary({
          month: summaryRes.data.month,
          year: summaryRes.data.year,
          income: Number(summaryRes.data.income),
          expense: Number(summaryRes.data.expense),
          balance: Number(summaryRes.data.balance),
        });
        setHealthSummary({
          ...healthRes.data,
          monthIncome: Number(healthRes.data.monthIncome),
          monthExpense: Number(healthRes.data.monthExpense),
          monthBalance: Number(healthRes.data.monthBalance),
          receivableOpen: Number(healthRes.data.receivableOpen),
          payableOpen: Number(healthRes.data.payableOpen),
        });
      })
      .finally(() => setLoading(false));
  }, []);

  // Filtra eventos e tarefas para hoje
  const today = useMemo(() => new Date(), []);
  function isToday(dateStr?: string | null) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  const todayEvents = useMemo(
    () =>
      events
        .filter((e) => isToday(e.start))
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
        .map((e) => ({ id: e.id, title: e.title, time: new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })),
    [events, today]
  );

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((t) => isToday(t.dueDate))
        .map((t) => ({ id: t.id, title: t.title })),
    [tasks, today]
  );

  const financialSummary = summary ?? {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    income: 0,
    expense: 0,
    balance: 0,
  };

  const monthLabel = monthFormatter.format(
    new Date(financialSummary.year, financialSummary.month - 1, 1)
  );
  const isPositiveBalance = financialSummary.balance >= 0;

  const flow = financialSummary.income + financialSummary.expense;
  const incomeShare = flow > 0 ? (financialSummary.income / flow) * 100 : 50;

  const stats = [
    { label: "Tarefas vencidas", value: healthSummary?.tasksOverdue ?? 0, tone: (healthSummary?.tasksOverdue ?? 0) > 0 ? "danger" : "default", icon: <AlertTriangle /> },
    { label: "Tarefas para hoje", value: healthSummary?.tasksDueToday ?? todayTasks.length, tone: "brand", icon: <CheckSquare /> },
    { label: "Eventos hoje", value: healthSummary?.eventsToday ?? todayEvents.length, tone: "default", icon: <CalendarClock /> },
    { label: "Notas totais", value: healthSummary?.notesTotal ?? 0, tone: "default", icon: <FileText /> },
    { label: "A receber em aberto", value: currencyFormatter.format(healthSummary?.receivableOpen ?? 0), tone: "success", icon: <ArrowDownLeft /> },
    { label: "A pagar em aberto", value: currencyFormatter.format(healthSummary?.payableOpen ?? 0), tone: "signal", icon: <ArrowUpRight /> },
  ] as const;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
        <PageHeader
          eyebrow="01 / Hoje"
          title="Visão geral"
          description={capitalizeFirst(dayFormatter.format(today))}
        />

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
                        {currencyFormatter.format(financialSummary.balance)}
                      </p>
                      <p className="mt-3 flex items-center gap-2 text-sm text-white/75">
                        <span className={isPositiveBalance ? "size-2 bg-success" : "size-2 bg-destructive"} />
                        {isPositiveBalance ? "No azul este mês." : "Gastos acima das receitas este mês."}
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
                      <p className="mt-2 font-mono text-xl tabular-nums">{currencyFormatter.format(financialSummary.income)}</p>
                    </div>
                    <div className="text-right">
                      <p className="label-tech flex items-center justify-end gap-2 text-muted-foreground">
                        Despesas <span className="hatch hatch-signal size-2 border border-signal" />
                      </p>
                      <p className="mt-2 font-mono text-xl tabular-nums">{currencyFormatter.format(financialSummary.expense)}</p>
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
              <TodayWidget events={todayEvents} tasks={todayTasks} />
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
