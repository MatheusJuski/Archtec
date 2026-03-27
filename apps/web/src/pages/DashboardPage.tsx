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

export function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/events"),
      api.get("/tasks"),
    ])
      .then(([eventsRes, tasksRes]) => {
        setEvents(eventsRes.data);
        setTasks(tasksRes.data);
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

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="flex justify-center mt-8">
      <TodayWidget events={todayEvents} tasks={todayTasks} />
    </div>
  );
}
