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
};

async function requestJson<T>(
	path: string,
	{ userId, signal }: RequestOptions
): Promise<T> {
	const response = await fetch(`${apiBaseUrl}${path}`, {
		headers: {
			Accept: "application/json",
			"X-User-Id": userId
		},
		signal
	});

	if (!response.ok) {
		const error = await readError(response);
		throw new ApiClientError(error.message, response.status, error.code);
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

