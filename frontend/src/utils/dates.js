export function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function getDeadlineCountdown(value) {
  if (!value) {
    return {
      label: "No deadline available yet",
      isOverdue: false,
    };
  }

  const deadline = new Date(value);

  if (Number.isNaN(deadline.getTime())) {
    return {
      label: "Invalid deadline",
      isOverdue: false,
    };
  }

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      label: "Overdue",
      isOverdue: true,
    };
  }

  const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) {
    return {
      label: `${days}d ${hours}h remaining`,
      isOverdue: false,
    };
  }

  return {
    label: `${hours}h remaining`,
    isOverdue: false,
  };
}