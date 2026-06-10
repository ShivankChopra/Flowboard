export type User = {
	id: string;
	name: string;
	role: "admin" | "member";
};

export type ContainerType = "workspace" | "space" | "folder" | "list";
export type ContainerVisibility = "public" | "private";

export type ContainerTreeNode = {
	id: string;
	name: string;
	type: ContainerType;
	parentId: string | null;
	position: number;
	visibility: ContainerVisibility;
	isArchived: boolean;
	children: ContainerTreeNode[];
};

export type Status = {
	id: string;
	listId: string;
	key: string;
	name: string;
	category: "todo" | "in_progress" | "done";
	color: string;
	position: number;
	isDefault: boolean;
	createdAt: string;
	updatedAt: string;
};

export type TaskPriority = "urgent" | "high" | "normal" | "low" | "none";

export type Task = {
	id: string;
	title: string;
	description: string | null;
	priority: TaskPriority;
	dueDate: string | null;
	position: number;
	primaryListId: string;
	statusId: string;
	assigneeIds: string[];
	createdAt: string;
	updatedAt: string;
};

export type PaginatedTasksResponse = {
	data: Task[];
	pagination: {
		limit: number;
		offset: number;
		total: number;
	};
};

export type TaskSort = "position" | "dueDate" | "priority";
export type SortDirection = "asc" | "desc";

export type TaskPayload = {
	title: string;
	description?: string | null;
	primaryListId?: string;
	statusId?: string;
	priority?: TaskPriority;
	assigneeIds?: string[];
	dueDate?: string | null;
};

type ApiErrorResponse = {
	code?: string;
	message?: string | string[];
};

export class ApiClientError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code?: string
	) {
		super(message);
		this.name = "ApiClientError";
	}
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000").replace(
	/\/$/,
	""
);

type RequestOptions = {
	userId: string;
	signal?: AbortSignal;
	method?: "GET" | "POST" | "PATCH" | "DELETE";
	body?: unknown;
};

async function requestJson<T>(
	path: string,
	{ userId, signal, method = "GET", body }: RequestOptions
): Promise<T> {
	const response = await fetch(`${apiBaseUrl}${path}`, {
		body: body === undefined ? undefined : JSON.stringify(body),
		headers: {
			Accept: "application/json",
			...(body === undefined ? {} : { "Content-Type": "application/json" }),
			"X-User-Id": userId
		},
		method,
		signal
	});

	if (!response.ok) {
		const error = await readError(response);
		throw new ApiClientError(error.message, response.status, error.code);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return response.json() as Promise<T>;
}

async function readError(response: Response): Promise<{ code?: string; message: string }> {
	try {
		const body = (await response.json()) as ApiErrorResponse;
		const message = Array.isArray(body.message)
			? body.message.join(" ")
			: body.message;

		return {
			code: body.code,
			message: message ?? `Request failed with status ${response.status}.`
		};
	} catch {
		return {
			message: `Request failed with status ${response.status}.`
		};
	}
}

export function listUsers(userId: string, signal?: AbortSignal): Promise<User[]> {
	return requestJson<User[]>("/users", { userId, signal });
}

export function getContainerTree(
	userId: string,
	signal?: AbortSignal
): Promise<ContainerTreeNode[]> {
	return requestJson<ContainerTreeNode[]>("/containers/tree", { userId, signal });
}

export function listStatuses(
	userId: string,
	listId: string,
	signal?: AbortSignal
): Promise<Status[]> {
	return requestJson<Status[]>(`/statuses?listId=${encodeURIComponent(listId)}`, {
		userId,
		signal
	});
}

export function listTasks(
	userId: string,
	options: {
		listId: string;
		limit?: number;
		offset?: number;
		sort?: TaskSort;
		direction?: SortDirection;
	},
	signal?: AbortSignal
): Promise<PaginatedTasksResponse> {
	const params = new URLSearchParams({
		listId: options.listId,
		limit: String(options.limit ?? 100),
		offset: String(options.offset ?? 0),
		sort: options.sort ?? "position",
		direction: options.direction ?? "asc"
	});

	return requestJson<PaginatedTasksResponse>(`/tasks?${params.toString()}`, {
		userId,
		signal
	});
}

export function createTask(userId: string, payload: TaskPayload): Promise<Task> {
	return requestJson<Task>("/tasks", {
		userId,
		method: "POST",
		body: payload
	});
}

export function updateTask(
	userId: string,
	taskId: string,
	payload: TaskPayload
): Promise<Task> {
	return requestJson<Task>(`/tasks/${taskId}`, {
		userId,
		method: "PATCH",
		body: payload
	});
}

export function moveTask(
	userId: string,
	taskId: string,
	payload: {
		targetListId?: string;
		targetStatusId?: string;
		targetPosition?: number;
	}
): Promise<Task> {
	return requestJson<Task>(`/tasks/${taskId}/move`, {
		userId,
		method: "POST",
		body: payload
	});
}

export function reorderTasks(
	userId: string,
	payload: {
		columns: Array<{
			listId: string;
			statusId: string;
			orderedTaskIds: string[];
		}>;
	}
): Promise<void> {
	return requestJson<void>("/tasks/reorder", {
		userId,
		method: "POST",
		body: payload
	});
}

export function deleteTask(userId: string, taskId: string): Promise<void> {
	return requestJson<void>(`/tasks/${taskId}`, {
		userId,
		method: "DELETE"
	});
}
