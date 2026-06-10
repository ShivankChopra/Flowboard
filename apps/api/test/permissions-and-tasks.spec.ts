import { HttpStatus, INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/common/errors/app-exception.filter";
import { ErrorCode } from "../src/common/errors/error-code";
import { createValidationException } from "../src/common/validation/validation-exception.factory";

const ids = {
	engineering: "00000000-0000-4000-8000-000000000002",
	backendBacklog: "00000000-0000-4000-8000-000000000004",
	webApp: "00000000-0000-4000-8000-000000000005",
	researchQueue: "00000000-0000-4000-8000-000000000008",
	statuses: {
		backendBacklog: {
			todo: "00000000-0000-4000-8000-000000000101",
			inProgress: "00000000-0000-4000-8000-000000000102"
		},
		webApp: {
			todo: "00000000-0000-4000-8000-000000000111",
			inProgress: "00000000-0000-4000-8000-000000000112"
		}
	},
	tasks: {
		backendPermissionChecks: "00000000-0000-4000-8000-000000001001",
		webSidebarShell: "00000000-0000-4000-8000-000000001006",
		researchThemes: "00000000-0000-4000-8000-000000001011"
	}
} as const;

type TestResponse<TBody = unknown> = {
	status: number;
	body: TBody;
};

type RequestOptions = {
	method?: string;
	userId?: string;
	body?: unknown;
};

type ErrorBody = {
	error: {
		code: string;
		message: string;
	};
};

type TreeNode = {
	id: string;
	name: string;
	children: TreeNode[];
};

type TaskBody = {
	id: string;
	title: string;
	primaryListId: string;
	statusId: string;
	assigneeIds: string[];
};

type StatusBody = {
	id: string;
	key: string;
	listId: string;
};

describe("Backend permissions and task workflows", () => {
	let app: INestApplication;
	let baseUrl: string;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule]
		}).compile();

		app = moduleRef.createNestApplication();
		app.useGlobalFilters(new AppExceptionFilter());
		app.useGlobalPipes(
			new ValidationPipe({
				forbidNonWhitelisted: true,
				transform: true,
				whitelist: true,
				exceptionFactory: createValidationException
			})
		);
		await app.init();
		await app.listen(0);
		baseUrl = await app.getUrl();
	});

	afterAll(async () => {
		await app.close();
	});

	async function request<TBody = unknown>(
		path: string,
		options: RequestOptions = {}
	): Promise<TestResponse<TBody>> {
		const headers: Record<string, string> = {};

		if (options.userId) {
			headers["X-User-Id"] = options.userId;
		}

		if (options.body !== undefined) {
			headers["Content-Type"] = "application/json";
		}

		const response = await fetch(`${baseUrl}${path}`, {
			method: options.method ?? "GET",
			headers,
			body: options.body === undefined ? undefined : JSON.stringify(options.body)
		});
		const text = await response.text();

		return {
			status: response.status,
			body: text ? JSON.parse(text) as TBody : null as TBody
		};
	}

	function flattenNames(nodes: TreeNode[]): string[] {
		return nodes.flatMap((node) => [node.name, ...flattenNames(node.children)]);
	}

	function expectError(response: TestResponse, status: number, code: string) {
		expect(response.status).toBe(status);
		expect(response.body).toMatchObject({
			error: {
				code,
				message: expect.any(String)
			}
		});
	}

	describe("tree permission filtering", () => {
		it("returns all seeded containers for Alice", async () => {
			const response = await request<TreeNode[]>("/containers/tree", { userId: "alice" });

			expect(response.status).toBe(HttpStatus.OK);
			expect(flattenNames(response.body)).toEqual(
				expect.arrayContaining([
					"Flowboard Workspace",
					"Engineering",
					"Q2 Launch",
					"Backend Backlog",
					"Web App",
					"Product",
					"Customer Feedback",
					"Research Queue"
				])
			);
		});

		it("hides Bob's explicitly denied Product subtree", async () => {
			const response = await request<TreeNode[]>("/containers/tree", { userId: "bob" });
			const names = flattenNames(response.body);

			expect(response.status).toBe(HttpStatus.OK);
			expect(names).toEqual(expect.arrayContaining(["Engineering", "Q2 Launch", "Web App"]));
			expect(names).not.toContain("Product");
			expect(names).not.toContain("Research Queue");
		});

		it("shows Carol's allowed private Product path and hides denied Web App", async () => {
			const response = await request<TreeNode[]>("/containers/tree", { userId: "carol" });
			const names = flattenNames(response.body);

			expect(response.status).toBe(HttpStatus.OK);
			expect(names).toEqual(expect.arrayContaining(["Product", "Customer Feedback", "Research Queue"]));
			expect(names).not.toContain("Web App");
		});

		it("hides archived containers by default", async () => {
			try {
				const archiveResponse = await request(`/containers/${ids.backendBacklog}/archive`, {
					method: "PATCH",
					userId: "alice",
					body: { isArchived: true }
				});
				expect(archiveResponse.status).toBe(HttpStatus.OK);

				const treeResponse = await request<TreeNode[]>("/containers/tree", { userId: "alice" });
				expect(flattenNames(treeResponse.body)).not.toContain("Backend Backlog");
			} finally {
				await request(`/containers/${ids.backendBacklog}/archive`, {
					method: "PATCH",
					userId: "alice",
					body: { isArchived: false }
				});
			}
		});
	});

	describe("denied access", () => {
		it("returns 403 when Bob reads a task in the denied Product subtree", async () => {
			const response = await request<ErrorBody>(`/tasks/${ids.tasks.researchThemes}`, {
				userId: "bob"
			});

			expectError(response, HttpStatus.FORBIDDEN, ErrorCode.Forbidden);
		});

		it("returns 403 when Carol reads a task in denied Web App", async () => {
			const response = await request<ErrorBody>(`/tasks/${ids.tasks.webSidebarShell}`, {
				userId: "carol"
			});

			expectError(response, HttpStatus.FORBIDDEN, ErrorCode.Forbidden);
		});

		it("returns 403 when a member mutates a container", async () => {
			const response = await request<ErrorBody>(`/containers/${ids.engineering}`, {
				method: "PATCH",
				userId: "bob",
				body: { name: "Engineering" }
			});

			expectError(response, HttpStatus.FORBIDDEN, ErrorCode.Forbidden);
		});

		it("returns 403 when a member manages grants", async () => {
			const response = await request<ErrorBody>(`/containers/${ids.webApp}/grants`, {
				userId: "bob"
			});

			expectError(response, HttpStatus.FORBIDDEN, ErrorCode.Forbidden);
		});
	});

	describe("admin bypass", () => {
		it("allows Alice to access private containers without explicit grants", async () => {
			const response = await request(`/containers/${ids.webApp}`, { userId: "alice" });

			expect(response.status).toBe(HttpStatus.OK);
			expect(response.body).toMatchObject({
				id: ids.webApp,
				name: "Web App",
				visibility: "private"
			});
		});

		it("allows Alice to access a container even with an explicit deny grant", async () => {
			try {
				const grantResponse = await request(`/containers/${ids.webApp}/grants/alice`, {
					method: "PUT",
					userId: "alice",
					body: { mode: "deny" }
				});
				expect(grantResponse.status).toBe(HttpStatus.OK);

				const containerResponse = await request(`/containers/${ids.webApp}`, {
					userId: "alice"
				});
				expect(containerResponse.status).toBe(HttpStatus.OK);
				expect(containerResponse.body).toMatchObject({ id: ids.webApp });
			} finally {
				await request(`/containers/${ids.webApp}/grants/alice`, {
					method: "DELETE",
					userId: "alice"
				});
			}
		});
	});

	describe("member task mutation", () => {
		it("lets Bob create, update, and delete a task in an accessible list", async () => {
			let taskId: string | null = null;

			try {
				const createResponse = await request<TaskBody>("/tasks", {
					method: "POST",
					userId: "bob",
					body: {
						title: "Phase 5 Bob mutation test",
						description: "Created by the focused backend test suite.",
						primaryListId: ids.webApp,
						statusId: ids.statuses.webApp.todo,
						priority: "normal",
						assigneeIds: ["bob"]
					}
				});
				expect(createResponse.status).toBe(HttpStatus.CREATED);
				taskId = createResponse.body.id;
				expect(createResponse.body).toMatchObject({
					title: "Phase 5 Bob mutation test",
					primaryListId: ids.webApp,
					statusId: ids.statuses.webApp.todo,
					assigneeIds: ["bob"]
				});

				const updateResponse = await request<TaskBody>(`/tasks/${taskId}`, {
					method: "PATCH",
					userId: "bob",
					body: {
						title: "Phase 5 Bob mutation test updated",
						statusId: ids.statuses.webApp.inProgress,
						assigneeIds: ["alice", "bob"]
					}
				});
				expect(updateResponse.status).toBe(HttpStatus.OK);
				expect(updateResponse.body).toMatchObject({
					title: "Phase 5 Bob mutation test updated",
					statusId: ids.statuses.webApp.inProgress,
					assigneeIds: expect.arrayContaining(["alice", "bob"])
				});

				const deleteResponse = await request(`/tasks/${taskId}`, {
					method: "DELETE",
					userId: "bob"
				});
				expect(deleteResponse.status).toBe(HttpStatus.NO_CONTENT);
				taskId = null;
			} finally {
				if (taskId) {
					await request(`/tasks/${taskId}`, {
						method: "DELETE",
						userId: "alice"
					});
				}
			}
		});
	});

	describe("status/list validation", () => {
		it("rejects creating a task with a status from another list", async () => {
			const response = await request<ErrorBody>("/tasks", {
				method: "POST",
				userId: "alice",
				body: {
					title: "Invalid status/list test",
					primaryListId: ids.backendBacklog,
					statusId: ids.statuses.webApp.todo
				}
			});

			expectError(response, HttpStatus.BAD_REQUEST, ErrorCode.ValidationError);
		});

		it("rejects updating a task to a status from another list", async () => {
			const response = await request<ErrorBody>(`/tasks/${ids.tasks.backendPermissionChecks}`, {
				method: "PATCH",
				userId: "alice",
				body: {
					statusId: ids.statuses.webApp.todo
				}
			});

			expectError(response, HttpStatus.BAD_REQUEST, ErrorCode.ValidationError);
		});

		it("remaps by status key when moving a task to another list", async () => {
			let taskId: string | null = null;

			try {
				const createResponse = await request<TaskBody>("/tasks", {
					method: "POST",
					userId: "alice",
					body: {
						title: "Phase 5 move remap test",
						primaryListId: ids.backendBacklog,
						statusId: ids.statuses.backendBacklog.inProgress
					}
				});
				expect(createResponse.status).toBe(HttpStatus.CREATED);
				taskId = createResponse.body.id;

				const moveResponse = await request<TaskBody>(`/tasks/${taskId}/move`, {
					method: "POST",
					userId: "alice",
					body: {
						targetListId: ids.webApp
					}
				});

				expect(moveResponse.status).toBe(HttpStatus.CREATED);
				expect(moveResponse.body).toMatchObject({
					primaryListId: ids.webApp,
					statusId: ids.statuses.webApp.inProgress
				});
			} finally {
				if (taskId) {
					await request(`/tasks/${taskId}`, {
						method: "DELETE",
						userId: "alice"
					});
				}
			}
		});

		it("returns 409 when deleting an in-use non-default status", async () => {
			const statusKey = `phase_5_in_use_${Date.now()}`;
			let statusId: string | null = null;
			let taskId: string | null = null;

			try {
				const createStatusResponse = await request<StatusBody>("/statuses", {
					method: "POST",
					userId: "alice",
					body: {
						listId: ids.backendBacklog,
						key: statusKey,
						name: "Phase 5 In Use",
						category: "in_progress",
						color: "#7c3aed"
					}
				});
				expect(createStatusResponse.status).toBe(HttpStatus.CREATED);
				statusId = createStatusResponse.body.id;

				const createTaskResponse = await request<TaskBody>("/tasks", {
					method: "POST",
					userId: "alice",
					body: {
						title: "Phase 5 in-use status task",
						primaryListId: ids.backendBacklog,
						statusId
					}
				});
				expect(createTaskResponse.status).toBe(HttpStatus.CREATED);
				taskId = createTaskResponse.body.id;

				const deleteStatusResponse = await request<ErrorBody>(`/statuses/${statusId}`, {
					method: "DELETE",
					userId: "alice"
				});
				expectError(deleteStatusResponse, HttpStatus.CONFLICT, ErrorCode.Conflict);
			} finally {
				if (taskId) {
					await request(`/tasks/${taskId}`, {
						method: "DELETE",
						userId: "alice"
					});
				}

				if (statusId) {
					await request(`/statuses/${statusId}`, {
						method: "DELETE",
						userId: "alice"
					});
				}
			}
		});
	});
});
