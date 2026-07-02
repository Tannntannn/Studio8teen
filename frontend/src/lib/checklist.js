/** Extract checklist from a booking with embedded event_checklists */
export function getBookingChecklist(booking) {
  if (!booking?.event_checklists) return null;
  const cl = booking.event_checklists;
  return Array.isArray(cl) ? cl[0] ?? null : cl;
}

export function getChecklistTasks(checklist) {
  if (!checklist?.tasks) return [];
  return Array.isArray(checklist.tasks) ? checklist.tasks : [];
}

export function getChecklistProgress(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const total = list.length;
  const checked = list.filter((t) => t.checked).length;
  return {
    checked,
    total,
    percent: total ? Math.round((checked / total) * 100) : 0,
  };
}

export function formatCheckedAt(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
