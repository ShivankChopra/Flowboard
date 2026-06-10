import type { Task, TaskAssignee } from "@prisma/client";

export type TaskDto = {
	id: string;
	title: string;
	description: string | null;
	priority: "urgent" | "high" | "normal" | "low" | "none";
	dueDate: string | null;
	position: number;
	primaryListId: string;
	statusId: string;
	assigneeIds: string[];
	createdAt: string;
	updatedAt: string;
};

export type PaginatedTasksResponse = {
	data: TaskDto[];
	pagination: {
		limit: number;
		offset: number;
		total: number;
	};
};

type TaskWithAssignees = Task & {
	assignees: Array<Pick<TaskAssignee, "userId">>;
};

export function toTaskDto(task: TaskWithAssignees): TaskDto {
	return {
		id: task.id,
		title: task.title,
		description: task.description,
		priority: task.priority,
		dueDate: task.dueDate?.toISOString() ?? null,
		position: task.position,
		primaryListId: task.primaryListId,
		statusId: task.statusId,
		assigneeIds: task.assignees.map((assignee) => assignee.userId),
		createdAt: task.createdAt.toISOString(),
		updatedAt: task.updatedAt.toISOString()
	};
}
