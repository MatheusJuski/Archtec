import { useEffect, useState, useMemo } from "react";
import { TodayWidget } from "@/components/TodayWidget";
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

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="mx-auto mt-8 grid w-full max-w-5xl gap-6 px-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-xl border border-border/60 bg-card/80 p-6 shadow-[0_20px_45px_-35px_rgba(0,0,0,0.8)]">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Saldo Atual
        </p>
        <h1 className={`mt-2 text-4xl font-semibold ${isPositiveBalance ? "text-toxic" : "text-ember"}`}>
          {currencyFormatter.format(financialSummary.balance)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">A saúde financeira em um relance.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Receitas</p>
            <p className="mt-2 text-xl font-semibold text-toxic">
              {currencyFormatter.format(financialSummary.income)}
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Despesas</p>
            <p className="mt-2 text-xl font-semibold text-ember">
              {currencyFormatter.format(financialSummary.expense)}
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">Período: {monthLabel}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tarefas vencidas</p>
            <p className="mt-2 text-xl font-semibold text-ember">{healthSummary?.tasksOverdue ?? 0}</p>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tarefas para hoje</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{healthSummary?.tasksDueToday ?? todayTasks.length}</p>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Eventos hoje</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{healthSummary?.eventsToday ?? todayEvents.length}</p>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Notas totais</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{healthSummary?.notesTotal ?? 0}</p>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">A receber em aberto</p>
            <p className="mt-2 text-xl font-semibold text-toxic">
              {currencyFormatter.format(healthSummary?.receivableOpen ?? 0)}
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">A pagar em aberto</p>
            <p className="mt-2 text-xl font-semibold text-ember">
              {currencyFormatter.format(healthSummary?.payableOpen ?? 0)}
            </p>
          </div>
        </div>
      </section>

      <div className="lg:justify-self-end lg:w-full">
        <TodayWidget events={todayEvents} tasks={todayTasks} />
      </div>
    </div>
  );
}
