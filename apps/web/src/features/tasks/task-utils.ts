import type { Status, Task, TaskPriority, User } from "../../api/client";

export const priorityOptions: Array<{ value: TaskPriority; label: string }> = [
	{ value: "urgent", label: "Urgent" },
	{ value: "high", label: "High" },
	{ value: "normal", label: "Normal" },
	{ value: "low", label: "Low" },
	{ value: "none", label: "None" }
];

export const priorityColor: Record<TaskPriority, "error" | "warning" | "info" | "default"> = {
	urgent: "error",
	high: "warning",
	normal: "info",
	low: "default",
	none: "default"
};

export function sortStatuses(statuses: Status[]): Status[] {
	return [...statuses].sort((a, b) => a.position - b.position);
}

export function sortTasksByPosition(tasks: Task[]): Task[] {
	return [...tasks].sort((a, b) => a.position - b.position);
}

export function tasksForStatus(tasks: Task[], statusId: string): Task[] {
	return sortTasksByPosition(tasks.filter((task) => task.statusId === statusId));
}

export function formatDueDate(isoDate: string | null): string {
	if (!isoDate) {
		return "No due date";
	}

	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric"
	}).format(new Date(isoDate));
}

export function dateInputValue(isoDate: string | null): string {
	if (!isoDate) {
		return "";
	}

	return isoDate.slice(0, 10);
}

export function dateInputToIso(dateValue: string): string | null {
	if (!dateValue) {
		return null;
	}

	return new Date(`${dateValue}T12:00:00.000Z`).toISOString();
}

export function userName(userId: string, users: User[]): string {
	return users.find((user) => user.id === userId)?.name ?? userId;
}

export function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
