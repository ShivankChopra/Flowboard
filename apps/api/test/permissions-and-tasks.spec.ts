import { HttpStatus, INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/common/errors/app-exception.filter";
import { ErrorCode } from "../src/common/errors/error-code";
import { createValidationException } from "../src/common/validation/validation-exception.factory";

const ids = {
	workspace: "00000000-0000-4000-8000-000000000001",
	engineering: "00000000-0000-4000-8000-000000000002",
	q2Launch: "00000000-0000-4000-8000-000000000003",
	backendBacklog: "00000000-0000-4000-8000-000000000004",
	webApp: "00000000-0000-4000-8000-000000000005",
	product: "00000000-0000-4000-8000-000000000006",
	customerFeedback: "00000000-0000-4000-8000-000000000007",
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
	parentId: string | null;
	visibility: "public" | "private";
	children: TreeNode[];
};

type ContainerBody = {
	id: string;
	name: string;
	parentId: string | null;
	position: number;
	visibility: "public" | "private";
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
		await restoreSeedContainerLayout();
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

	function findTreeNode(nodes: TreeNode[], nodeId: string): TreeNode | null {
		for (const node of nodes) {
			if (node.id === nodeId) {
				return node;
			}

			const match = findTreeNode(node.children, nodeId);

			if (match) {
				return match;
			}
		}

		return null;
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

	async function restoreSeedContainerLayout() {
		const treeResponse = await request<TreeNode[]>("/containers/tree", {
			userId: "alice"
		});
		expect(treeResponse.status).toBe(HttpStatus.OK);
		const engineering = findTreeNode(treeResponse.body, ids.engineering);
		const q2Launch = findTreeNode(treeResponse.body, ids.q2Launch);

		expect(engineering).not.toBeNull();
		expect(q2Launch).not.toBeNull();

		const restoreEngineeringVisibilityResponse = await request<ContainerBody>(
			`/containers/${ids.engineering}`,
			{
				method: "PATCH",
				userId: "alice",
				body: { visibility: "public" }
			}
		);
		expect(restoreEngineeringVisibilityResponse.status).toBe(HttpStatus.OK);

		const restoreProductVisibilityResponse = await request<ContainerBody>(
			`/containers/${ids.product}`,
			{
				method: "PATCH",
				userId: "alice",
				body: { visibility: "public" }
			}
		);
		expect(restoreProductVisibilityResponse.status).toBe(HttpStatus.OK);

		const restoreQ2Response = await request<ContainerBody[]>(
			`/containers/${ids.q2Launch}/reorder`,
			{
				method: "POST",
				userId: "alice",
				body: {
					parentId: ids.engineering,
					orderedIds: [
						...(engineering?.children ?? [])
							.map((child) => child.id)
							.filter((childId) => childId !== ids.q2Launch),
						ids.q2Launch
					]
				}
			}
		);
		expect(restoreQ2Response.status).toBe(HttpStatus.CREATED);

		const restoreQ2VisibilityResponse = await request<ContainerBody>(
			`/containers/${ids.q2Launch}`,
			{
				method: "PATCH",
				userId: "alice",
				body: { visibility: "public" }
			}
		);
		expect(restoreQ2VisibilityResponse.status).toBe(HttpStatus.OK);

		const restoreBacklogResponse = await request<ContainerBody[]>(
			`/containers/${ids.backendBacklog}/reorder`,
			{
				method: "POST",
				userId: "alice",
				body: {
					parentId: ids.q2Launch,
					orderedIds: [
						ids.backendBacklog,
						...(q2Launch?.children ?? [])
							.map((child) => child.id)
							.filter((childId) => childId !== ids.backendBacklog)
					]
				}
			}
		);
		expect(restoreBacklogResponse.status).toBe(HttpStatus.CREATED);

		const restoreBacklogVisibilityResponse = await request<ContainerBody>(
			`/containers/${ids.backendBacklog}`,
			{
				method: "PATCH",
				userId: "alice",
				body: { visibility: "public" }
			}
		);
		expect(restoreBacklogVisibilityResponse.status).toBe(HttpStatus.OK);
	}

	async function createContainer(
		body: {
			name: string;
			type: "space" | "folder" | "list";
			parentId: string;
			visibility?: "public" | "private";
		}
	): Promise<ContainerBody> {
		const response = await request<ContainerBody>("/containers", {
			method: "POST",
			userId: "alice",
			body
		});
		expect(response.status).toBe(HttpStatus.CREATED);

		return response.body;
	}

	async function deleteContainer(containerId: string): Promise<void> {
		const response = await request(`/containers/${containerId}`, {
			method: "DELETE",
			userId: "alice"
		});
		expect(response.status).toBe(HttpStatus.NO_CONTENT);
	}

	async function childIdsFor(parentId: string): Promise<string[]> {
		const treeResponse = await request<TreeNode[]>("/containers/tree", {
			userId: "alice"
		});
		expect(treeResponse.status).toBe(HttpStatus.OK);
		const parent = findTreeNode(treeResponse.body, parentId);

		expect(parent).not.toBeNull();
		return parent?.children.map((child) => child.id) ?? [];
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

		it("reveals only the ancestor lineage for an explicitly allowed nested private list", async () => {
			let folderId: string | null = null;
			let allowedListId: string | null = null;
			let siblingListId: string | null = null;
			const suffix = Date.now();
			const folderName = `Lineage Folder ${suffix}`;
			const allowedListName = `Allowed Lineage List ${suffix}`;
			const siblingListName = `Hidden Lineage Sibling ${suffix}`;

			try {
				const folder = await createContainer({
					name: folderName,
					type: "folder",
					parentId: ids.engineering,
					visibility: "private"
				});
				folderId = folder.id;

				const allowedList = await createContainer({
					name: allowedListName,
					type: "list",
					parentId: folderId,
					visibility: "private"
				});
				allowedListId = allowedList.id;

				const siblingList = await createContainer({
					name: siblingListName,
					type: "list",
					parentId: folderId,
					visibility: "private"
				});
				siblingListId = siblingList.id;

				const grantResponse = await request(`/containers/${allowedListId}/grants/carol`, {
					method: "PUT",
					userId: "alice",
					body: { mode: "allow" }
				});
				expect(grantResponse.status).toBe(HttpStatus.OK);

				const response = await request<TreeNode[]>("/containers/tree", { userId: "carol" });
				const names = flattenNames(response.body);
				const folderNode = findTreeNode(response.body, folderId);

				expect(response.status).toBe(HttpStatus.OK);
				expect(names).toEqual(expect.arrayContaining([folderName, allowedListName]));
				expect(names).not.toContain(siblingListName);
				expect(folderNode?.children.map((child) => child.id)).toEqual([allowedListId]);

				const folderResponse = await request<ContainerBody>(`/containers/${folderId}`, {
					userId: "carol"
				});
				expect(folderResponse.status).toBe(HttpStatus.OK);
				expect(folderResponse.body).toMatchObject({ id: folderId });
			} finally {
				if (allowedListId) {
					await request(`/containers/${allowedListId}/grants/carol`, {
						method: "DELETE",
						userId: "alice"
					});
				}

				if (siblingListId) {
					await deleteContainer(siblingListId);
				}

				if (allowedListId) {
					await deleteContainer(allowedListId);
				}

				if (folderId) {
					await deleteContainer(folderId);
				}
			}
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

		it("rejects descendant allow grants while an ancestor deny is still present", async () => {
			const response = await request<ErrorBody>(`/containers/${ids.researchQueue}/grants/bob`, {
				method: "PUT",
				userId: "alice",
				body: { mode: "allow" }
			});

			expectError(response, HttpStatus.CONFLICT, ErrorCode.Conflict);
			expect(response.body.error.message).toContain("Bob Chen is explicitly denied on Product");
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

	describe("container move and reorder", () => {
		it("lets Alice move a folder between valid parent spaces", async () => {
			let folderId: string | null = null;

			try {
				const folder = await createContainer({
					name: `Move Test Folder ${Date.now()}`,
					type: "folder",
					parentId: ids.engineering,
					visibility: "public"
				});
				folderId = folder.id;
				const productChildIds = await childIdsFor(ids.product);

				const response = await request<ContainerBody[]>(`/containers/${folderId}/reorder`, {
					method: "POST",
					userId: "alice",
					body: {
						parentId: ids.product,
						orderedIds: [...productChildIds, folderId]
					}
				});

				expect(response.status).toBe(HttpStatus.CREATED);
				expect(response.body.map((container) => container.id)).toEqual([
					...productChildIds,
					folderId
				]);
				expect(response.body.find((container) => container.id === folderId)).toMatchObject({
					parentId: ids.product,
					position: productChildIds.length
				});

				const movedContainerResponse = await request<ContainerBody>(
					`/containers/${folderId}`,
					{ userId: "alice" }
				);
				expect(movedContainerResponse.status).toBe(HttpStatus.OK);
				expect(movedContainerResponse.body).toMatchObject({
					parentId: ids.product,
					visibility: "public"
				});

				const bobTreeResponse = await request<TreeNode[]>("/containers/tree", {
					userId: "bob"
				});
				expect(bobTreeResponse.status).toBe(HttpStatus.OK);
				expect(flattenNames(bobTreeResponse.body)).not.toContain(folder.name);
			} finally {
				if (folderId) {
					await deleteContainer(folderId);
				}
			}
		});

		it("makes a moved public subtree private when the target parent path is private", async () => {
			let listId: string | null = null;
			let listName: string | null = null;

			try {
				const list = await createContainer({
					name: `Private Move Test List ${Date.now()}`,
					type: "list",
					parentId: ids.q2Launch,
					visibility: "public"
				});
				listId = list.id;
				listName = list.name;
				const customerFeedbackChildIds = await childIdsFor(ids.customerFeedback);

				const response = await request<ContainerBody[]>(
					`/containers/${listId}/reorder`,
					{
						method: "POST",
						userId: "alice",
						body: {
							parentId: ids.customerFeedback,
							orderedIds: [...customerFeedbackChildIds, listId]
						}
					}
				);

				expect(response.status).toBe(HttpStatus.CREATED);
				expect(response.body.find((container) => container.id === listId)).toMatchObject({
					parentId: ids.customerFeedback,
					position: customerFeedbackChildIds.length,
					visibility: "private"
				});

				const movedContainerResponse = await request<ContainerBody>(
					`/containers/${listId}`,
					{ userId: "alice" }
				);
				expect(movedContainerResponse.status).toBe(HttpStatus.OK);
				expect(movedContainerResponse.body).toMatchObject({
					parentId: ids.customerFeedback,
					visibility: "private"
				});

				const carolTreeResponse = await request<TreeNode[]>("/containers/tree", {
					userId: "carol"
				});
				expect(carolTreeResponse.status).toBe(HttpStatus.OK);
				expect(flattenNames(carolTreeResponse.body)).not.toContain(listName);
			} finally {
				if (listId) {
					await deleteContainer(listId);
				}
			}
		});

		it("rejects moving a list under another list", async () => {
			let listId: string | null = null;

			try {
				const list = await createContainer({
					name: `Invalid Move Test List ${Date.now()}`,
					type: "list",
					parentId: ids.q2Launch,
					visibility: "public"
				});
				listId = list.id;

				const response = await request<ErrorBody>(
					`/containers/${listId}/reorder`,
					{
						method: "POST",
						userId: "alice",
						body: {
							parentId: ids.webApp,
							orderedIds: [listId]
						}
					}
				);

				expectError(response, HttpStatus.BAD_REQUEST, ErrorCode.ValidationError);
			} finally {
				if (listId) {
					await deleteContainer(listId);
				}
			}
		});

		it("returns 403 when a member tries to move a container", async () => {
			let folderId: string | null = null;

			try {
				const folder = await createContainer({
					name: `Member Move Test Folder ${Date.now()}`,
					type: "folder",
					parentId: ids.engineering,
					visibility: "public"
				});
				folderId = folder.id;
				const productChildIds = await childIdsFor(ids.product);

				const response = await request<ErrorBody>(`/containers/${folderId}/reorder`, {
					method: "POST",
					userId: "bob",
					body: {
						parentId: ids.product,
						orderedIds: [...productChildIds, folderId]
					}
				});

				expectError(response, HttpStatus.FORBIDDEN, ErrorCode.Forbidden);
			} finally {
				if (folderId) {
					await deleteContainer(folderId);
				}
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
