import React from "react";

interface TodayWidgetProps {
  events: Array<{ id: string; title: string; time: string }>;
  tasks: Array<{ id: string; title: string }>;
}

export const TodayWidget: React.FC<TodayWidgetProps> = ({ events, tasks }) => {
  const hasEvents = events && events.length > 0;
  const hasTasks = tasks && tasks.length > 0;
  const isEmpty = !hasEvents && !hasTasks;

  return (
    <div className="p-4 rounded-lg shadow bg-white w-full max-w-md">
      <h2 className="text-lg font-bold mb-4">Hoje</h2>
      {hasEvents && (
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Eventos</h3>
          <ul className="space-y-2">
            {events.map((event) => (
              <li key={event.id} className="border p-2 rounded">
                <span className="font-medium">{event.time}</span> — {event.title}
              </li>
            ))}
          </ul>
        </div>
      )}
      {hasTasks && (
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Tarefas</h3>
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task.id} className="border p-2 rounded">
                {task.title}
              </li>
            ))}
          </ul>
        </div>
      )}
      {isEmpty && (
        <div className="text-center text-gray-500 py-8">
          Seu dia está livre!
        </div>
      )}
    </div>
  );
};
