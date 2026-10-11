import React from "react";
import { Link } from "react-router-dom";
import { Coffee } from "lucide-react";
import { Panel } from "@/components/ui/panel";

interface TodayWidgetProps {
  events: Array<{ id: string; title: string; time: string }>;
  tasks: Array<{ id: string; title: string }>;
}

export const TodayWidget: React.FC<TodayWidgetProps> = ({ events, tasks }) => {
  const hasEvents = events && events.length > 0;
  const hasTasks = tasks && tasks.length > 0;
  const isEmpty = !hasEvents && !hasTasks;

  return (
    <Panel
      title="Agenda de hoje"
      aside={<span className="label-tech">{events.length + tasks.length} itens</span>}
      flush
      className="h-full"
    >
      {hasEvents && (
        <div className="border-b border-line p-4">
          <h3 className="label-tech mb-3 text-muted-foreground">Eventos</h3>
          <ul className="space-y-1">
            {events.map((event) => (
              <li key={event.id} className="group flex items-baseline gap-3 py-1.5">
                <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-brand">{event.time}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{event.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {hasTasks && (
        <div className="p-4">
          <h3 className="label-tech mb-3 text-muted-foreground">Tarefas</h3>
          <ul className="space-y-1">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span aria-hidden className="size-2.5 shrink-0 border border-ink" />
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
              </li>
            ))}
          </ul>
          <Link to="/tasks" className="label-tech mt-3 inline-block text-brand hover:underline">
            Ver todas →
          </Link>
        </div>
      )}
      {isEmpty && (
        <div className="hatch m-4 flex flex-col items-center gap-3 border border-dashed border-line px-4 py-12 text-center">
          <Coffee className="h-6 w-6 text-muted-foreground" />
          <p className="font-heading text-lg font-bold">Seu dia está livre</p>
          <p className="text-xs text-muted-foreground">Nenhum evento ou tarefa para hoje.</p>
        </div>
      )}
    </Panel>
  );
};
