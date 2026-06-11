export type User = {
	id: string;
	name: string;
	role: "admin" | "member";
};

export type ContainerType = "workspace" | "space" | "folder" | "list";
export type ContainerVisibility = "public" | "private";

export type Container = {
	id: string;
	name: string;
	type: ContainerType;
	parentId: string | null;
	position: number;
	visibility: ContainerVisibility;
	isArchived: boolean;
	createdAt: string;
	updatedAt: string;
};

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

export type GrantMode = "allow" | "deny";

export type Grant = {
	id: string;
	resourceId: string;
	userId: string;
	mode: GrantMode;
	createdAt: string;
	updatedAt: string;
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

export type StatusCategory = "todo" | "in_progress" | "done";

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

export type CreateContainerPayload = {
	name: string;
	type: Exclude<ContainerType, "workspace">;
	parentId: string;
	visibility?: ContainerVisibility;
};

export type UpdateContainerPayload = {
	name?: string;
	visibility?: ContainerVisibility;
};

export type ReorderContainerPayload = {
	parentId: string;
	orderedIds: string[];
};

export type CreateStatusPayload = {
	listId: string;
	key: string;
	name: string;
	category: StatusCategory;
	color: string;
	position?: number;
};

export type UpdateStatusPayload = {
	name?: string;
	category?: StatusCategory;
	color?: string;
	position?: number;
};

type ApiErrorResponse = {
	code?: string;
	error?: {
		code?: string;
		message?: string | string[];
	};
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
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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
		const serverError = body.error;
		const rawMessage = serverError?.message ?? body.message;
		const message = Array.isArray(rawMessage)
			? rawMessage.join(" ")
			: rawMessage;

		return {
			code: serverError?.code ?? body.code,
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
	signal?: AbortSignal,
	includeArchived = false
): Promise<ContainerTreeNode[]> {
	const params = includeArchived ? "?includeArchived=true" : "";

	return requestJson<ContainerTreeNode[]>(`/containers/tree${params}`, { userId, signal });
}

export function createContainer(
	userId: string,
	payload: CreateContainerPayload
): Promise<Container> {
	return requestJson<Container>("/containers", {
		userId,
		method: "POST",
		body: payload
	});
}

export function updateContainer(
	userId: string,
	containerId: string,
	payload: UpdateContainerPayload
): Promise<Container> {
	return requestJson<Container>(`/containers/${containerId}`, {
		userId,
		method: "PATCH",
		body: payload
	});
}

export function reorderContainer(
	userId: string,
	containerId: string,
	payload: ReorderContainerPayload
): Promise<Container[]> {
	return requestJson<Container[]>(`/containers/${containerId}/reorder`, {
		userId,
		method: "POST",
		body: payload
	});
}

export function archiveContainer(
	userId: string,
	containerId: string,
	isArchived: boolean
): Promise<Container> {
	return requestJson<Container>(`/containers/${containerId}/archive`, {
		userId,
		method: "PATCH",
		body: { isArchived }
	});
}

export function deleteContainer(userId: string, containerId: string): Promise<void> {
	return requestJson<void>(`/containers/${containerId}`, {
		userId,
		method: "DELETE"
	});
}

export function listGrants(
	userId: string,
	containerId: string,
	signal?: AbortSignal
): Promise<Grant[]> {
	return requestJson<Grant[]>(`/containers/${containerId}/grants`, {
		userId,
		signal
	});
}

export function upsertGrant(
	userId: string,
	containerId: string,
	targetUserId: string,
	mode: GrantMode
): Promise<Grant> {
	return requestJson<Grant>(`/containers/${containerId}/grants/${targetUserId}`, {
		userId,
		method: "PUT",
		body: { mode }
	});
}

export function deleteGrant(
	userId: string,
	containerId: string,
	targetUserId: string
): Promise<void> {
	return requestJson<void>(`/containers/${containerId}/grants/${targetUserId}`, {
		userId,
		method: "DELETE"
	});
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

export function createStatus(
	userId: string,
	payload: CreateStatusPayload
): Promise<Status> {
	return requestJson<Status>("/statuses", {
		userId,
		method: "POST",
		body: payload
	});
}

export function updateStatus(
	userId: string,
	statusId: string,
	payload: UpdateStatusPayload
): Promise<Status> {
	return requestJson<Status>(`/statuses/${statusId}`, {
		userId,
		method: "PATCH",
		body: payload
	});
}

export function deleteStatus(userId: string, statusId: string): Promise<void> {
	return requestJson<void>(`/statuses/${statusId}`, {
		userId,
		method: "DELETE"
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
		q?: string;
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
	const searchQuery = options.q?.trim();

	if (searchQuery) {
		params.set("q", searchQuery);
	}

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
