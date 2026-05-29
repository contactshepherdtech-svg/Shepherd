export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No attendance";
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeDays(days: number | null) {
  if (days === null) return "No activity yet";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
