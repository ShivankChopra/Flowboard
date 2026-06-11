import type { Status, Task, TaskPriority, User } from "../../api/client";

export type PriorityVisual = {
	label: string;
	color: string;
	background: string;
	border: string;
};

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

export const priorityVisuals: Record<TaskPriority, PriorityVisual> = {
	urgent: {
		label: "Urgent",
		color: "#b42318",
		background: "#fff1f0",
		border: "#f6b7ad"
	},
	high: {
		label: "High",
		color: "#b54708",
		background: "#fff7e6",
		border: "#ffd18a"
	},
	normal: {
		label: "Normal",
		color: "#175cd3",
		background: "#eff6ff",
		border: "#b9d6ff"
	},
	low: {
		label: "Low",
		color: "#475467",
		background: "#f8fafc",
		border: "#d0d5dd"
	},
	none: {
		label: "None",
		color: "#667085",
		background: "#ffffff",
		border: "#d0d5dd"
	}
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

export function userInitials(userId: string, users: User[]): string {
	const name = userName(userId, users).trim();
	const parts = name.split(/\s+/).filter(Boolean);

	if (parts.length === 0) {
		return userId.slice(0, 2).toUpperCase();
	}

	if (parts.length === 1) {
		return parts[0].slice(0, 2).toUpperCase();
	}

	return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function userAvatarColor(userId: string): string {
	const palette = [
		"#2563eb",
		"#7c3aed",
		"#0891b2",
		"#059669",
		"#db2777",
		"#ea580c"
	];
	const hash = [...userId].reduce(
		(total, character) => total + character.charCodeAt(0),
		0
	);

	return palette[hash % palette.length];
}

export function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
