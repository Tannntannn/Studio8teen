import { FaCheck } from "react-icons/fa";
import {
  getBookingChecklist,
  getChecklistProgress,
  getChecklistTasks,
  formatCheckedAt,
} from "../../lib/checklist";

export default function ClientChecklistSummary({ booking, compact = false }) {
  const checklist = getBookingChecklist(booking);
  const tasks = getChecklistTasks(checklist);
  const { checked, total, percent } = getChecklistProgress(tasks);

  if (!tasks.length) {
    return (
      <p className="text-xs text-gray-400 italic">Client has not started preparation checklist yet.</p>
    );
  }

  if (compact) {
    return (
      <div className="mt-2">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Preparation checklist</span>
          <span className="font-medium text-[#5B4636]">
            {checked}/{total} done ({percent}%)
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#A98B75] rounded-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        {checked > 0 && (
          <ul className="mt-2 space-y-0.5">
            {tasks.filter((t) => t.checked).map((task, i) => (
              <li key={i} className="text-[11px] text-green-700 flex items-center gap-1">
                <FaCheck size={8} className="flex-shrink-0" />
                <span className="truncate">{task.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-[#5B4636]">Client Preparation Checklist</h4>
        <span className="text-xs font-medium text-[#A98B75]">
          {checked}/{total} completed ({percent}%)
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-[#A98B75] rounded-full transition-all" style={{ width: `${percent}%` }} />
      </div>
      <ul className="space-y-2">
        {tasks.map((task, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 text-sm p-2 rounded-lg ${
              task.checked ? "bg-green-50 text-green-800" : "bg-gray-50 text-gray-600"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                task.checked ? "bg-green-500 text-white" : "border-2 border-gray-300"
              }`}
            >
              {task.checked && <FaCheck size={10} />}
            </span>
            <div>
              <span className={task.checked ? "line-through opacity-80" : ""}>{task.label}</span>
              {task.checked && task.checked_at && (
                <p className="text-[10px] text-green-600 mt-0.5">Checked {formatCheckedAt(task.checked_at)}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
