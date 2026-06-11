import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString })
});

const ids = {
	workspace: "00000000-0000-4000-8000-000000000001",
	engineering: "00000000-0000-4000-8000-000000000002",
	q2Launch: "00000000-0000-4000-8000-000000000003",
	backendBacklog: "00000000-0000-4000-8000-000000000004",
	webApp: "00000000-0000-4000-8000-000000000005",
	product: "00000000-0000-4000-8000-000000000006",
	customerFeedback: "00000000-0000-4000-8000-000000000007",
	researchQueue: "00000000-0000-4000-8000-000000000008"
} as const;

const listIds = [ids.backendBacklog, ids.webApp, ids.researchQueue] as const;

const statusIds = {
	[ids.backendBacklog]: {
		todo: "00000000-0000-4000-8000-000000000101",
		in_progress: "00000000-0000-4000-8000-000000000102",
		done: "00000000-0000-4000-8000-000000000103"
	},
	[ids.webApp]: {
		todo: "00000000-0000-4000-8000-000000000111",
		in_progress: "00000000-0000-4000-8000-000000000112",
		done: "00000000-0000-4000-8000-000000000113"
	},
	[ids.researchQueue]: {
		todo: "00000000-0000-4000-8000-000000000121",
		in_progress: "00000000-0000-4000-8000-000000000122",
		done: "00000000-0000-4000-8000-000000000123"
	}
} as const;

const defaultStatuses = [
	{ key: "todo", name: "Todo", category: "todo", color: "#64748b", position: 0 },
	{
		key: "in_progress",
		name: "In Progress",
		category: "in_progress",
		color: "#2563eb",
		position: 1
	},
	{ key: "done", name: "Done", category: "done", color: "#16a34a", position: 2 }
] as const;

type TaskSeed = {
	id: string;
	title: string;
	description?: string;
	priority: "urgent" | "high" | "normal" | "low" | "none";
	dueDate?: string;
	listId: keyof typeof statusIds;
	statusKey: keyof (typeof statusIds)[keyof typeof statusIds];
	position: number;
	assigneeIds?: string[];
};

const tasks: TaskSeed[] = [
	{
		id: "00000000-0000-4000-8000-000000001001",
		title: "Design task permission checks",
		description: [
			"## Permission check plan",
			"Define service-level checks before exposing task mutation routes.",
			"",
			"### Rules to cover",
			"- **Admins** bypass container grants.",
			"- Members can mutate tasks only when they can access the task's `primaryListId`.",
			"- A parent `deny` must hide the whole subtree.",
			"",
			"Demo note: try Bob against the Product research task and confirm the API returns `403`."
		].join("\n"),
		priority: "urgent",
		dueDate: "2026-06-18T10:00:00.000Z",
		listId: ids.backendBacklog,
		statusKey: "todo",
		position: 0,
		assigneeIds: ["alice"]
	},
	{
		id: "00000000-0000-4000-8000-000000001002",
		title: "Add list status validation",
		description: [
			"## Status/list validation",
			"Reject task updates when `statusId` does not belong to `primaryListId`.",
			"",
			"### Acceptance checks",
			"- Creating a task without `statusId` uses the list's default `todo` status.",
			"- Moving between lists maps by status key when possible.",
			"- Invalid cross-list status updates return **validation errors**, not silent remaps."
		].join("\n"),
		priority: "high",
		dueDate: "2026-06-20T10:00:00.000Z",
		listId: ids.backendBacklog,
		statusKey: "todo",
		position: 1,
		assigneeIds: ["bob"]
	},
	{
		id: "00000000-0000-4000-8000-000000001003",
		title: "Implement task reorder transaction",
		priority: "high",
		listId: ids.backendBacklog,
		statusKey: "in_progress",
		position: 0,
		assigneeIds: ["alice", "bob"]
	},
	{
		id: "00000000-0000-4000-8000-000000001004",
		title: "Return consistent API errors",
		description: "Normalize validation, auth, permission, and conflict failures.",
		priority: "normal",
		dueDate: "2026-06-24T10:00:00.000Z",
		listId: ids.backendBacklog,
		statusKey: "in_progress",
		position: 1
	},
	{
		id: "00000000-0000-4000-8000-000000001005",
		title: "Create health endpoint",
		priority: "low",
		listId: ids.backendBacklog,
		statusKey: "done",
		position: 0,
		assigneeIds: ["alice"]
	},
	{
		id: "00000000-0000-4000-8000-000000001006",
		title: "Build sidebar tree shell",
		description: [
			"## Sidebar tree shell",
			"Render the full workspace hierarchy with clear collapse state.",
			"",
			"### Must show",
			"- Workspace, spaces, folders, and lists in one nested tree.",
			"- Visibility badges for **private** containers.",
			"- Different trees when switching between Alice, Bob, and Carol.",
			"",
			"Reference behavior: [MUI tree view patterns](https://mui.com/material-ui/react-tree-view/)."
		].join("\n"),
		priority: "high",
		dueDate: "2026-06-19T10:00:00.000Z",
		listId: ids.webApp,
		statusKey: "todo",
		position: 0,
		assigneeIds: ["bob"]
	},
	{
		id: "00000000-0000-4000-8000-000000001007",
		title: "Create user switcher",
		priority: "normal",
		listId: ids.webApp,
		statusKey: "todo",
		position: 1,
		assigneeIds: ["alice", "bob"]
	},
	{
		id: "00000000-0000-4000-8000-000000001008",
		title: "Wire kanban columns to list statuses",
		description: [
			"## Kanban status mapping",
			"Columns must come from the selected list's status set, not a global enum.",
			"",
			"### Interaction details",
			"- Drag within a column rewrites `position` for that status.",
			"- Drag to another column updates `statusId` and target position.",
			"- Failed moves should refetch tasks and show a visible error.",
			"",
			"Keep the board fast and predictable for the demo path."
		].join("\n"),
		priority: "urgent",
		dueDate: "2026-06-21T10:00:00.000Z",
		listId: ids.webApp,
		statusKey: "in_progress",
		position: 0,
		assigneeIds: ["bob"]
	},
	{
		id: "00000000-0000-4000-8000-000000001009",
		title: "Add task drawer markdown preview",
		description: [
			"# Markdown preview",
			"Use markdown for task descriptions. Do **not** enable raw HTML.",
			"",
			"### Supported formatting",
			"- Headings for structure.",
			"- Bullets for acceptance criteria.",
			"- Inline code like `primaryListId` and `statusId`.",
			"- External links such as [CommonMark](https://commonmark.org/).",
			"",
			"Demo this task in the drawer to show rich task notes."
		].join("\n"),
		priority: "normal",
		dueDate: "2026-06-27T10:00:00.000Z",
		listId: ids.webApp,
		statusKey: "in_progress",
		position: 1
	},
	{
		id: "00000000-0000-4000-8000-000000001010",
		title: "Choose Material UI base theme",
		priority: "low",
		listId: ids.webApp,
		statusKey: "done",
		position: 0,
		assigneeIds: ["alice"]
	},
	{
		id: "00000000-0000-4000-8000-000000001011",
		title: "Tag top feedback themes",
		description: [
			"## Feedback themes",
			"Cluster interview notes into themes the team can act on during Q2 launch.",
			"",
			"### Current tags",
			"- **Navigation clarity**: users need stronger hierarchy cues.",
			"- **Task ownership**: assignees should be visible without opening a task.",
			"- **Due date visibility**: late work should stand out in dense views.",
			"",
			"Use these tags to validate the list and board presentation."
		].join("\n"),
		priority: "normal",
		dueDate: "2026-06-23T10:00:00.000Z",
		listId: ids.researchQueue,
		statusKey: "todo",
		position: 0,
		assigneeIds: ["carol"]
	},
	{
		id: "00000000-0000-4000-8000-000000001012",
		title: "Summarize onboarding interviews",
		priority: "high",
		dueDate: "2026-06-25T10:00:00.000Z",
		listId: ids.researchQueue,
		statusKey: "todo",
		position: 1,
		assigneeIds: ["carol"]
	},
	{
		id: "00000000-0000-4000-8000-000000001013",
		title: "Review workspace terminology",
		priority: "low",
		listId: ids.researchQueue,
		statusKey: "in_progress",
		position: 0,
		assigneeIds: ["alice", "carol"]
	},
	{
		id: "00000000-0000-4000-8000-000000001014",
		title: "Draft Q2 launch research notes",
		description: [
			"## Q2 launch research notes",
			"Capture findings in a format that can be opened directly from the demo task drawer.",
			"",
			"### Draft outline",
			"- What users expect from a lightweight workspace.",
			"- Where permission differences need to be obvious.",
			"- Which task metadata helps scanning: **status**, **priority**, **assignee**, and **due date**.",
			"",
			"Search demo idea: search for `permission` or `metadata` in this list."
		].join("\n"),
		priority: "normal",
		listId: ids.researchQueue,
		statusKey: "in_progress",
		position: 1,
		assigneeIds: ["carol"]
	},
	{
		id: "00000000-0000-4000-8000-000000001015",
		title: "Import initial feedback samples",
		priority: "none",
		listId: ids.researchQueue,
		statusKey: "done",
		position: 0
	}
];

async function resetDemoData() {
	await prisma.$transaction(async (tx) => {
		await tx.taskAssignee.deleteMany();
		await tx.task.deleteMany();
		await tx.status.deleteMany();
		await tx.grant.deleteMany();
		await tx.container.deleteMany({ where: { type: "list" } });
		await tx.container.deleteMany({ where: { type: "folder" } });
		await tx.container.deleteMany({ where: { type: "space" } });
		await tx.container.deleteMany({ where: { type: "workspace" } });
		await tx.user.deleteMany();
	});
}

async function seedDemoData() {
	await prisma.$transaction(async (tx) => {
		await tx.user.createMany({
			data: [
				{ id: "alice", name: "Alice Morgan", role: "admin" },
				{ id: "bob", name: "Bob Chen", role: "member" },
				{ id: "carol", name: "Carol Diaz", role: "member" }
			]
		});

		await tx.container.createMany({
			data: [
				{
					id: ids.workspace,
					name: "Flowboard Workspace",
					type: "workspace",
					parentId: null,
					position: 0,
					visibility: "public"
				},
				{
					id: ids.engineering,
					name: "Engineering",
					type: "space",
					parentId: ids.workspace,
					position: 0,
					visibility: "public"
				},
				{
					id: ids.product,
					name: "Product",
					type: "space",
					parentId: ids.workspace,
					position: 1,
					visibility: "public"
				},
				{
					id: ids.q2Launch,
					name: "Q2 Launch",
					type: "folder",
					parentId: ids.engineering,
					position: 0,
					visibility: "public"
				},
				{
					id: ids.customerFeedback,
					name: "Customer Feedback",
					type: "folder",
					parentId: ids.product,
					position: 0,
					visibility: "private"
				},
				{
					id: ids.backendBacklog,
					name: "Backend Backlog",
					type: "list",
					parentId: ids.q2Launch,
					position: 0,
					visibility: "public"
				},
				{
					id: ids.webApp,
					name: "Web App",
					type: "list",
					parentId: ids.q2Launch,
					position: 1,
					visibility: "private"
				},
				{
					id: ids.researchQueue,
					name: "Research Queue",
					type: "list",
					parentId: ids.customerFeedback,
					position: 0,
					visibility: "private"
				}
			]
		});

		for (const listId of listIds) {
			await tx.status.createMany({
				data: defaultStatuses.map((status) => ({
					id: statusIds[listId][status.key],
					listId,
					key: status.key,
					name: status.name,
					category: status.category,
					color: status.color,
					position: status.position,
					isDefault: true
				}))
			});
		}

		await tx.grant.createMany({
			data: [
				{
					id: "00000000-0000-4000-8000-000000000201",
					resourceId: ids.engineering,
					userId: "bob",
					mode: "allow"
				},
				{
					id: "00000000-0000-4000-8000-000000000202",
					resourceId: ids.webApp,
					userId: "bob",
					mode: "allow"
				},
				{
					id: "00000000-0000-4000-8000-000000000203",
					resourceId: ids.product,
					userId: "bob",
					mode: "deny"
				},
				{
					id: "00000000-0000-4000-8000-000000000204",
					resourceId: ids.product,
					userId: "carol",
					mode: "allow"
				},
				{
					id: "00000000-0000-4000-8000-000000000205",
					resourceId: ids.customerFeedback,
					userId: "carol",
					mode: "allow"
				},
				{
					id: "00000000-0000-4000-8000-000000000206",
					resourceId: ids.researchQueue,
					userId: "carol",
					mode: "allow"
				},
				{
					id: "00000000-0000-4000-8000-000000000207",
					resourceId: ids.webApp,
					userId: "carol",
					mode: "deny"
				}
			]
		});

		for (const task of tasks) {
			await tx.task.create({
				data: {
					id: task.id,
					title: task.title,
					description: task.description,
					priority: task.priority,
					dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
					position: task.position,
					primaryListId: task.listId,
					statusId: statusIds[task.listId][task.statusKey],
					assignees: task.assigneeIds?.length
						? {
								createMany: {
									data: task.assigneeIds.map((userId) => ({ userId }))
								}
							}
						: undefined
				}
			});
		}
	});
}

async function main() {
	await resetDemoData();
	await seedDemoData();
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (error) => {
		console.error(error);
		await prisma.$disconnect();
		process.exit(1);
	});
