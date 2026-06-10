# AI-Audited Development Plan

This document turns the product and technical decisions in `03-ai-audited-final-decisions.md` into an implementation plan that can be executed in auditable chunks.

The plan intentionally covers database, seed scripts, backend, Docker, frontend, and focused backend tests in one document. Flowboard is a full-stack MVP, and the safest implementation checkpoints are vertical product slices rather than separate backend and frontend planning documents.

## 1. Implementation Goal

Build Flowboard as a complete single-workspace project-management MVP covering:

- Workspace hierarchy: `workspace -> space -> folder -> list`.
- List-owned status sets.
- Task CRUD, status changes, list moves, and kanban/list ordering.
- Permission-filtered tree and task access for Alice, Bob, and Carol.
- Admin controls for containers, visibility, grants, and statuses.
- Member task workflows inside accessible lists.
- Dockerized local development.
- Focused backend tests before frontend implementation.

The implementation must optimize for evaluator clarity, correctness, and inspectability. Avoid production-scale additions that are not required by the assignment or the locked decisions.

## 2. Explicit Scope Boundaries

Included in the planned MVP:

- Mock auth with `X-User-Id` matching a user ID from the database. Seeded examples are `alice`, `bob`, and `carol`.
- PostgreSQL with Prisma migrations and seed script.
- NestJS REST API.
- React/Vite frontend using Material UI.
- TanStack Query for server-state fetching and mutations.
- `@hello-pangea/dnd` for kanban drag-and-drop.
- Markdown rendering for task descriptions using `react-markdown`.
- Focused Jest backend tests for permission and task-access behavior.

Deferred unless a later decision explicitly adds them:

- JWT/session auth.
- Signup/login.
- Team/group grants.
- Subtasks.
- Real-time updates.
- OpenAPI/Swagger.
- Full-text search.
- Frontend E2E tests.
- Activity feed.
- Production deployment.

## 3. Repository And Tooling

Use an npm workspace monorepo:

```text
flowboard/
  apps/
    api/
    web/
  packages/
    shared/
  docs/
  docker-compose.yml
  Dockerfile
  package.json
  package-lock.json
  README.md
  AI_USAGE.md
```

Workspace decisions:

- Use npm workspaces for evaluator familiarity.
- Keep `packages/shared` minimal and optional.
- Use `packages/shared` only for stable types/constants that are genuinely shared by API and web, such as user roles, priorities, container types, visibility values, or API DTO types.
- Do not add shared abstractions before duplication is real.

Root scripts should eventually include:

```json
{
  "scripts": {
    "dev": "docker compose up --build",
    "dev:api": "npm --workspace apps/api run start:dev",
    "dev:web": "npm --workspace apps/web run dev",
    "db:migrate": "npm --workspace apps/api run prisma:migrate",
    "db:seed": "npm --workspace apps/api run prisma:seed",
    "test:api": "npm --workspace apps/api run test",
    "lint": "npm --workspaces run lint",
    "typecheck": "npm --workspaces run typecheck"
  }
}
```

## 4. Docker Development Plan

Docker Compose should orchestrate the whole app for local development:

- `postgres`: PostgreSQL database.
- `api`: NestJS API container.
- `web`: Vite React web container.

Use one root `Dockerfile` with named targets:

- `api-dev`
- `web-dev`
- optional later production targets if needed.

Expected compose behavior:

- `docker compose up --build` starts PostgreSQL, API, and web.
- API waits for PostgreSQL before serving.
- API runs Prisma migration and seed through explicit commands, not hidden container startup magic.
- Use explicit commands such as `docker compose run --rm api npm run prisma:migrate` and `docker compose run --rm api npm run prisma:seed` for database setup.
- README documents the initial setup sequence clearly:
  - start services,
  - run migrations,
  - run seed,
  - open the web app.

Default local ports:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

Environment variables:

```text
DATABASE_URL=postgresql://flowboard:flowboard@postgres:5432/flowboard?schema=public
PORT=3000
VITE_API_BASE_URL=http://localhost:3000
```

Include `.env.example` files and do not commit secrets.

## 5. Database Design

Use Prisma with PostgreSQL. The schema should prioritize relational integrity and straightforward permission queries.

### 5.1 Enums

```prisma
enum UserRole {
  admin
  member
}

enum ContainerType {
  workspace
  space
  folder
  list
}

enum ContainerVisibility {
  public
  private
}

enum GrantMode {
  allow
  deny
}

enum TaskPriority {
  urgent
  high
  normal
  low
  none
}

enum StatusCategory {
  todo
  in_progress
  done
}
```

### 5.2 Models

Core models:

```prisma
model User {
  id              String         @id
  name            String
  role            UserRole
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  grants          Grant[]
  taskAssignments TaskAssignee[]
}

model Container {
  id          String              @id @default(uuid())
  name        String
  type        ContainerType
  parentId    String?
  parent      Container?          @relation("ContainerTree", fields: [parentId], references: [id])
  children    Container[]         @relation("ContainerTree")
  position    Int
  visibility  ContainerVisibility @default(public)
  isArchived  Boolean             @default(false)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  grants      Grant[]
  statuses    Status[]
  tasks       Task[]

  @@index([parentId, position])
  @@index([type])
  @@index([visibility])
}

model Grant {
  id          String    @id @default(uuid())
  resourceId  String
  userId      String
  mode        GrantMode
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  resource    Container @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([resourceId, userId])
  @@index([userId, mode])
}

model Status {
  id        String         @id @default(uuid())
  listId    String
  key       String
  name      String
  category  StatusCategory
  color     String
  position  Int
  isDefault Boolean        @default(false)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  list      Container      @relation(fields: [listId], references: [id], onDelete: Cascade)
  tasks     Task[]

  @@unique([listId, key])
  @@unique([listId, position])
  @@index([listId])
}

model Task {
  id            String           @id @default(uuid())
  title         String
  description   String?
  priority      TaskPriority     @default(none)
  dueDate       DateTime?
  position      Int
  primaryListId String
  statusId      String
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  primaryList   Container        @relation(fields: [primaryListId], references: [id], onDelete: Cascade)
  status        Status           @relation(fields: [statusId], references: [id])
  assignees     TaskAssignee[]

  @@index([primaryListId, statusId, position])
  @@index([statusId])
  @@index([dueDate])
}

model TaskAssignee {
  taskId    String
  userId    String
  createdAt DateTime @default(now())

  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([taskId, userId])
  @@index([userId])
}
```

Important validation that Prisma cannot fully express:

- `Container.type = workspace` must have `parentId = null`.
- `space` parent must be `workspace`.
- `folder` parent must be `space`.
- `list` parent must be `folder`.
- `Status.listId` must reference a container whose type is `list`.
- `Task.primaryListId` must reference a container whose type is `list`.
- `Task.statusId` must reference a status belonging to `Task.primaryListId`.
- `ContainerVisibility.public` is invalid under any private ancestor.
- Archived ancestors hide descendants from normal tree results.

These rules must be enforced in services and covered where risk is highest.

### 5.3 Ordering

Container positions:

- `position` is scoped to siblings under the same `parentId`.
- Reorder APIs should rewrite affected sibling positions transactionally.
- Use integer positions starting at `0`.

Task positions:

- `position` is scoped to `(primaryListId, statusId)`.
- Moving across status/list recomputes the target column positions transactionally.
- Reorder endpoint should accept the ordered task IDs for the affected source/target columns.

## 6. Seed Data Plan

Seed script location:

```text
apps/api/prisma/seed.ts
```

Seed users:

```text
alice: Alice Morgan, admin
bob: Bob Chen, member
carol: Carol Diaz, member
```

Seed hierarchy:

```text
Flowboard Workspace
  Engineering (public)
    Q2 Launch (public)
      Backend Backlog (public)
      Web App (private)
  Product (public)
    Customer Feedback (private)
      Research Queue (public is invalid under private, so seed as private)
```

This gives:

- 1 workspace.
- 2 spaces.
- 2 folders.
- 3 lists.
- Public and private containers.
- A private ancestor case.
- Clear Alice/Bob/Carol tree differences.

Seed grants:

- Alice needs no grants because admin bypasses permissions.
- Bob:
  - allow `Engineering` or `Q2 Launch`.
  - allow `Web App`.
  - deny `Product`.
- Carol:
  - allow `Product`.
  - allow `Customer Feedback`.
  - allow `Research Queue`.
  - deny `Web App`.

Seed visibility expectations:

- Alice sees everything.
- Bob sees Engineering, Q2 Launch, Backend Backlog, and Web App; Bob does not see Product subtree.
- Carol sees Engineering public path except explicitly denied Web App, and sees Product/Customer Feedback/Research Queue through allows.

Seed statuses:

Every list gets:

```text
todo: Todo, todo, #64748b, position 0, default
in_progress: In Progress, in_progress, #2563eb, position 1, default
done: Done, done, #16a34a, position 2, default
```

Seed tasks:

- At least 15 tasks total.
- Distribute across all 3 lists and all 3 statuses.
- Include varied priorities.
- Include due dates on some tasks.
- Include assigned and unassigned tasks.
- Include markdown descriptions on some tasks.
- Use stable, demo-friendly titles that make the app feel realistic.

Seed reset behavior:

- Seed should be idempotent for local development.
- Prefer deleting existing demo rows and recreating them in a transaction.
- Do not rely on generated UUIDs in frontend code.

## 7. Backend Architecture

Backend location:

```text
apps/api/
  src/
    app.module.ts
    main.ts
    prisma/
    auth/
    common/
    users/
    permissions/
    containers/
    statuses/
    tasks/
```

Nest module responsibilities:

- `PrismaModule`: exposes `PrismaService`.
- `AuthModule`: resolves `X-User-Id` to the current user.
- `CommonModule`: error filter, validation pipe helpers, shared DTO utilities.
- `UsersModule`: seeded user lookup for the UI switcher.
- `PermissionsModule`: central visibility and access logic.
- `ContainersModule`: hierarchy CRUD, tree, archive, reorder, visibility, grants.
- `StatusesModule`: list status reads and admin status configuration.
- `TasksModule`: task CRUD, pagination, status changes, list moves, reorder.

Controller code should stay thin. Business rules belong in services. Permission checks should not be duplicated ad hoc in controllers.

## 8. Backend Foundation Decisions

### 8.1 App Bootstrap

`main.ts` should configure:

- Global route prefix only if useful; default can be no prefix for assignment simplicity.
- CORS for the Vite dev origin.
- Global `ValidationPipe` with whitelist enabled.
- Global exception filter that normalizes errors into the required shape.

Standard error response:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

Status mappings:

- `401`: `AUTH_REQUIRED` or `INVALID_USER`.
- `403`: `FORBIDDEN`.
- `404`: `NOT_FOUND`.
- `400`: `VALIDATION_ERROR`.
- `409`: `CONFLICT`.

### 8.2 Mock Auth

The API uses `X-User-Id`.

Implementation:

- `CurrentUser` decorator exposes the resolved user.
- `MockAuthGuard` reads the header and loads the user by ID from the `users` table.
- Missing/unknown users return `401`.
- The MVP seed creates Alice, Bob, and Carol, but auth and API types should accept any user ID that exists in the database.
- All app routes except basic health checks require the guard.

Do not implement JWT for MVP.

### 8.3 DTO Validation

Use `class-validator` and `class-transformer`.

Validation examples:

- Task title: required, string, max 500.
- Optional description: string.
- Priority: enum.
- Assignee IDs: string array.
- Due date: ISO datetime.
- Pagination: `limit` default `50`, max `100`, `offset` default `0`.
- Container visibility: enum.
- Grant mode: enum.

## 9. Permission Engine

Create a dedicated `PermissionsService`.

Core methods:

```ts
canSeeContainer(user: User, containerId: string): Promise<boolean>
assertCanSeeContainer(user: User, containerId: string): Promise<void>
assertCanMutateContainer(user: User): void
assertCanManageStatuses(user: User): void
assertCanManageGrants(user: User): void
assertCanAccessList(user: User, listId: string): Promise<void>
assertCanReadTask(user: User, taskId: string): Promise<void>
assertCanMutateTask(user: User, taskId: string): Promise<void>
filterVisibleTree(user: User, includeArchived?: boolean): Promise<TreeNode[]>
```

Permission semantics:

- Admin users bypass all container visibility and deny rules.
- Members can see public containers only if all ancestors are visible and no explicit deny exists on the path.
- Members can see private containers only with an explicit allow and a visible ancestor path.
- Explicit deny on any ancestor or the resource itself blocks access.
- A descendant allow cannot override an ancestor deny.
- Descendants of hidden parents are hidden.
- Archived containers are hidden by default; archived ancestors hide descendants.

Implementation approach:

- Load the full non-archived container set and all grants for the current user for tree filtering.
- Build parent paths in memory for the single-workspace MVP.
- Keep the algorithm explicit and readable; assignment scale does not require recursive SQL.
- For direct access checks, load the target container and ancestors, then evaluate grants and visibility.

Admin-only mutation checks:

- Container create/update/reorder/archive/delete.
- Visibility changes.
- Grant changes.
- Status configuration.

Member-allowed mutations:

- Task create/update/delete/move/reorder inside accessible lists.

## 10. API Route Plan

All routes require `X-User-Id` unless explicitly stated.

### 10.1 Health

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| `GET` | `/health` | Basic API health check | Public |

### 10.2 Users

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| `GET` | `/users` | List seeded users for switcher | Authenticated |
| `GET` | `/users/me` | Current resolved user | Authenticated |

User response:

```ts
type UserDto = {
  id: string;
  name: string;
  role: "admin" | "member";
};
```

### 10.3 Containers

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| `GET` | `/containers/tree?includeArchived=false` | Permission-filtered hierarchy | Authenticated |
| `GET` | `/containers/:id` | Read visible container | Must see container |
| `POST` | `/containers` | Create container | Admin |
| `PATCH` | `/containers/:id` | Rename or update visibility | Admin |
| `POST` | `/containers/:id/reorder` | Reorder siblings or valid move | Admin |
| `PATCH` | `/containers/:id/archive` | Archive/unarchive subtree | Admin |
| `DELETE` | `/containers/:id` | Hard-delete empty accidental create | Admin |
| `GET` | `/containers/:id/grants` | List grants for container | Admin |
| `PUT` | `/containers/:id/grants/:userId` | Upsert allow/deny grant | Admin |
| `DELETE` | `/containers/:id/grants/:userId` | Remove explicit grant | Admin |

Create container request:

```ts
type CreateContainerRequest = {
  name: string;
  type: "space" | "folder" | "list";
  parentId: string;
  visibility?: "public" | "private";
};
```

Update container request:

```ts
type UpdateContainerRequest = {
  name?: string;
  visibility?: "public" | "private";
};
```

Reorder request:

```ts
type ReorderContainerRequest = {
  parentId: string;
  orderedIds: string[];
};
```

Archive request:

```ts
type ArchiveContainerRequest = {
  isArchived: boolean;
};
```

Grant request:

```ts
type UpsertGrantRequest = {
  mode: "allow" | "deny";
};
```

Tree node response:

```ts
type ContainerTreeNodeDto = {
  id: string;
  name: string;
  type: "workspace" | "space" | "folder" | "list";
  parentId: string | null;
  position: number;
  visibility: "public" | "private";
  isArchived: boolean;
  children: ContainerTreeNodeDto[];
};
```

Container validation:

- Creating workspace through API is not required.
- Parent/type rules are enforced.
- List children are rejected.
- Making a child public under a private ancestor is rejected.
- Changing a container from public to private updates descendants to private in the same transaction.
- Deleting non-empty containers returns `409`.

### 10.4 Statuses

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| `GET` | `/statuses?listId=:listId` | List statuses for accessible list | Must access list |
| `POST` | `/statuses` | Create custom status | Admin |
| `PATCH` | `/statuses/:id` | Rename/recolor/reorder status | Admin |
| `DELETE` | `/statuses/:id` | Delete non-default unused status | Admin |

Create status request:

```ts
type CreateStatusRequest = {
  listId: string;
  key: string;
  name: string;
  category: "todo" | "in_progress" | "done";
  color: string;
  position?: number;
};
```

Update status request:

```ts
type UpdateStatusRequest = {
  name?: string;
  category?: "todo" | "in_progress" | "done";
  color?: string;
  position?: number;
};
```

Rules:

- Default statuses are non-deletable.
- Status keys are unique per list.
- Status positions are unique per list.
- Deleting a status used by tasks returns `409`.
- Status operations against non-list containers are rejected.

### 10.5 Tasks

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| `GET` | `/tasks?listId=:listId&limit=50&offset=0&sort=position` | Paginated list tasks | Must access list |
| `GET` | `/tasks/:id` | Read task details | Must access task list |
| `POST` | `/tasks` | Create task | Must access list |
| `PATCH` | `/tasks/:id` | Update task fields | Must access task list |
| `POST` | `/tasks/:id/move` | Move between status/list | Must access source and target lists |
| `POST` | `/tasks/reorder` | Reorder within/across columns | Must access affected lists |
| `DELETE` | `/tasks/:id` | Hard-delete task | Must access task list |

Task response:

```ts
type TaskDto = {
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
```

Create task request:

```ts
type CreateTaskRequest = {
  title: string;
  description?: string;
  primaryListId: string;
  statusId?: string;
  priority?: "urgent" | "high" | "normal" | "low" | "none";
  assigneeIds?: string[];
  dueDate?: string;
};
```

Update task request:

```ts
type UpdateTaskRequest = {
  title?: string;
  description?: string | null;
  statusId?: string;
  priority?: "urgent" | "high" | "normal" | "low" | "none";
  assigneeIds?: string[];
  dueDate?: string | null;
};
```

Move task request:

```ts
type MoveTaskRequest = {
  targetListId?: string;
  targetStatusId?: string;
  targetPosition?: number;
};
```

Reorder tasks request:

```ts
type ReorderTasksRequest = {
  columns: Array<{
    listId: string;
    statusId: string;
    orderedTaskIds: string[];
  }>;
};
```

Task list response:

```ts
type PaginatedTasksResponse = {
  data: TaskDto[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};
```

Task list query:

```ts
type ListTasksQuery = {
  listId: string;
  limit?: number;
  offset?: number;
  sort?: "position" | "dueDate" | "priority";
  direction?: "asc" | "desc";
};
```

Rules:

- If `statusId` is omitted on create, use the list's `todo` status.
- Task status must belong to the task's primary list.
- Moving to a target list uses the matching status key if available, otherwise the target list's `todo`.
- Moving or reordering rewrites positions transactionally.
- Members can mutate tasks in accessible lists.
- Moving between lists requires access to both source and target lists.

## 11. Focused Backend Test Plan

Backend tests must be implemented before frontend work starts.

Test style:

- Use Jest.
- Prefer integration-style tests against Nest services/controllers with a test database.
- Tests should seed deterministic data before each suite or use the main seed plus isolated mutations.
- Use real permission logic, not mocked permission outcomes.

Minimum test suites:

### 11.1 Tree Permission Filtering

Cases:

- Alice sees all seeded containers.
- Bob does not see the Product subtree because of explicit deny.
- Carol sees the private Product path only where explicit allows provide the path.
- Carol does not see Web App because of explicit deny.
- Archived containers are hidden by default.

### 11.2 Denied Access Returns 403

Cases:

- Bob fetching a task from a denied Product list returns `403`.
- Carol fetching a task from denied Web App returns `403`.
- Member trying to mutate a container returns `403`.
- Member trying to manage grants returns `403`.

### 11.3 Admin Bypass

Cases:

- Alice can access private containers without explicit grants.
- Alice can access containers with explicit deny grants if such a fixture is present.
- Alice can mutate container visibility/status configuration.

### 11.4 Member Task Mutation

Cases:

- Bob can create/update/delete a task in Web App if explicitly allowed.
- Carol can create/update/delete a task in Research Queue if explicitly allowed.
- Mutation response uses the standard task DTO shape with `assigneeIds`.

### 11.5 Status/List Validation

Cases:

- Creating a task with a status from another list returns `400`.
- Updating a task to a status from another list returns `400`.
- Moving a task to another list remaps by status key when possible.
- Deleting an in-use status returns `409`.

Audit requirement before UI:

- All focused backend tests must pass.
- Manual API calls should confirm `403` error shape.
- The permission service should be readable and centralized.

## 12. Frontend Architecture

Frontend location:

```text
apps/web/
  src/
    main.tsx
    App.tsx
    api/
    components/
    features/
      app-shell/
      users/
      containers/
      lists/
      tasks/
      statuses/
      permissions/
    state/
    theme/
    types/
```

Primary frontend dependencies:

- React.
- Vite.
- Material UI.
- TanStack Query.
- `@hello-pangea/dnd`.
- `react-markdown`.

Frontend design direction:

- Desktop-first project-management interface.
- Dense, work-focused layout.
- Left sidebar tree, main selected-list workspace, right drawer for task details.
- No marketing landing page.
- No oversized hero sections or decorative layouts.

## 13. Frontend State Model

Separate state into three categories.

### 13.1 Server State

Use TanStack Query for:

- Users.
- Current-user-dependent tree.
- Statuses for selected list.
- Tasks for selected list.
- Container details.
- Grants for selected container.
- Mutations for task/container/status/grant operations.

Query key conventions:

```ts
["users"]
["tree", currentUserId, includeArchived]
["container", currentUserId, containerId]
["statuses", currentUserId, listId]
["tasks", currentUserId, listId, { limit, offset, sort }]
["grants", currentUserId, containerId]
```

Mutation invalidation examples:

- Container mutation invalidates `["tree", currentUserId]`.
- Visibility/grant mutation invalidates tree and grants.
- Status mutation invalidates statuses and tasks for the list.
- Task mutation invalidates tasks for the affected list.
- Moving a task between lists invalidates source and target task queries.
- Switching user invalidates or naturally separates queries by `currentUserId`.

### 13.2 Global UI State

Use a small React context or reducer for:

```ts
type AppUiState = {
  currentUserId: string;
  selectedListId: string | null;
  expandedContainerIds: string[];
  includeArchived: boolean;
  activeListView: "kanban" | "list";
};
```

Global UI state should not store copies of server data.

Behavior:

- On user switch, reload tree and clear selected list if it is no longer visible.
- Preserve expanded nodes where still visible.
- Default selected list should be the first visible list if none is selected.
- `includeArchived` is mainly useful for admins.

### 13.3 Component-Local State

Keep local state for:

- Open/closed menus.
- Dialog mode and form drafts.
- Task drawer open state and edit mode.
- Current task form fields before save.
- List sort selection.
- Drag operation transient state.
- Confirmation dialog state.

Do not put transient form drafts in global context.

## 14. API Client Plan

Create a typed fetch wrapper:

```text
src/api/client.ts
src/api/users.ts
src/api/containers.ts
src/api/statuses.ts
src/api/tasks.ts
```

Client responsibilities:

- Add `X-User-Id` header from current UI state.
- Use `VITE_API_BASE_URL`.
- Parse standard error shape.
- Throw typed client errors that UI can display.
- Keep endpoint functions small and direct.

Example function groups:

```ts
usersApi.listUsers()
usersApi.getMe(userId)

containersApi.getTree(userId, includeArchived)
containersApi.create(userId, request)
containersApi.update(userId, id, request)
containersApi.reorder(userId, id, request)
containersApi.archive(userId, id, request)
containersApi.delete(userId, id)
containersApi.listGrants(userId, containerId)
containersApi.upsertGrant(userId, containerId, targetUserId, request)
containersApi.deleteGrant(userId, containerId, targetUserId)

statusesApi.list(userId, listId)
statusesApi.create(userId, request)
statusesApi.update(userId, statusId, request)
statusesApi.delete(userId, statusId)

tasksApi.list(userId, request)
tasksApi.get(userId, taskId)
tasksApi.create(userId, request)
tasksApi.update(userId, taskId, request)
tasksApi.move(userId, taskId, request)
tasksApi.reorder(userId, request)
tasksApi.delete(userId, taskId)
```

## 15. Component Breakdown

### 15.1 App Shell

Components:

```text
App
  QueryClientProvider
  AppUiProvider
  AppLayout
```

`AppLayout`:

- Fixed-height full-screen app layout.
- Left sidebar.
- Top bar or compact header with user switcher.
- Main content area.
- Global snackbar/error surface.

### 15.2 User Switcher

Components:

```text
UserSwitcher
CurrentUserBadge
```

Behavior:

- Fetch users through TanStack Query.
- Switch between Alice, Bob, and Carol.
- Show role clearly.
- Changing user updates global `currentUserId`.
- After switching user, tree and list data refetch with the new header.

### 15.3 Sidebar Tree

Components:

```text
Sidebar
ContainerTree
ContainerTreeNode
ContainerNodeActions
ContainerDialog
ArchiveConfirmDialog
DeleteConfirmDialog
```

Behavior:

- Render nested `workspace -> space -> folder -> list`.
- Collapse/expand nodes.
- Selecting a list updates `selectedListId`.
- Show visibility/archive indicators.
- Admin sees action menu for create, rename, visibility, archive, delete, and grants.
- Members do not see mutation controls unless a disabled state improves clarity.
- Archive/delete require confirmation.

Container creation rules in UI:

- Workspace can create spaces.
- Space can create folders.
- Folder can create lists.
- List cannot create child containers.

Container visibility UI:

- Admin can toggle public/private where valid.
- If ancestor is private, public option is disabled with an explanatory tooltip.
- Changing public to private warns that descendants become private.

### 15.4 Permission Management

Components:

```text
PermissionDialog
GrantRow
GrantModeSelect
```

Behavior:

- Admin-only.
- Open from container action menu.
- Show Bob and Carol grant rows.
- Alice does not need grants; either hide Alice or show admin bypass read-only.
- Each member row supports:
  - no explicit grant,
  - allow,
  - deny.
- Saving upserts or deletes grant records.
- After saving, invalidate grants and tree.

The permission UI should remain simple. It is not a role-management product.

### 15.5 Status Management

Components:

```text
StatusSettingsDialog
StatusRow
StatusForm
DeleteStatusConfirmDialog
```

Behavior:

- Admin-only.
- Open from selected list toolbar.
- Show statuses ordered by position.
- Allow rename, color, category, reorder where practical.
- Allow create custom status.
- Default statuses cannot be deleted.
- In-use status deletion errors should show the backend message.

### 15.6 Selected List Workspace

Components:

```text
SelectedListWorkspace
ListToolbar
ViewTabs
KanbanBoard
TaskListView
TaskDrawer
```

Behavior:

- If no list is selected, show an empty prompt to select a list.
- If selected list is no longer visible after user switch, clear selection and choose first visible list when available.
- Fetch statuses and tasks for selected list.
- Show loading and error states.
- Provide create task action.
- Provide status settings action for admins.

### 15.7 Kanban Board

Components:

```text
KanbanBoard
KanbanColumn
TaskCard
CreateTaskInColumnButton
```

Behavior:

- Columns are statuses ordered by `position`.
- Cards are grouped by `statusId` and ordered by `position`.
- Card shows title, priority, assignee initials, and due date.
- Click card opens task drawer.
- Drag within column calls task reorder.
- Drag across columns calls task move/reorder.
- On mutation failure, refetch tasks and show error.

Optimistic updates:

- Basic optimistic local reorder is allowed if simple.
- If it becomes risky, prefer mutation plus refetch for correctness.
- Do not spend MVP time on complex conflict handling.

### 15.8 Dense List View

Components:

```text
TaskListView
TaskListToolbar
TaskListRow
PriorityBadge
StatusChip
AssigneeAvatars
DueDateText
```

Behavior:

- Dense list rather than heavy data grid.
- Rows show title, status, assignees, priority, due date.
- Sort by due date and priority through compact controls.
- Click row opens task drawer.
- Include compact create task action.

Sorting:

- UI can sort client-side after fetching tasks for MVP.
- Backend supports pagination; if dataset grows, server-side sorting can be expanded later.

### 15.9 Task Drawer

Components:

```text
TaskDrawer
TaskReadView
TaskEditForm
TaskDeleteConfirmDialog
MarkdownDescription
```

Behavior:

- Right-side drawer.
- Used for create, read, and edit.
- Fields:
  - title,
  - description,
  - status,
  - priority,
  - assignees,
  - due date.
- Read mode renders markdown description.
- Edit mode uses controlled form local state.
- Delete requires confirmation.
- Members can edit tasks in accessible lists.

## 16. Frontend Permission Behavior

Frontend should reflect backend permissions, but never replace backend enforcement.

Rules:

- Admin users see container, grant, and status controls.
- Member users do not see admin-only controls unless a disabled state clarifies the role distinction.
- Members see task controls in accessible lists.
- If a backend mutation returns `403`, show the error message and refetch relevant data.
- User switching is the main demo surface for permission differences.

Manual demo expectations:

- Alice can see and manage everything.
- Bob's sidebar differs from Carol's.
- A denied list/task cannot be opened by URL/API call.
- Task creation/editing works for members in accessible lists.

## 17. Auditable Development Phases

These phases are not calendar days. They are implementation checkpoints. After each phase, stop and manually inspect whether scope is correct before asking AI to continue.

### Phase 0: Scaffold, Tooling, And Docker

Goal:

- Create the monorepo and local development foundation.

Expected output:

```text
package.json
package-lock.json
Dockerfile
docker-compose.yml
.env.example
apps/api/
apps/web/
packages/shared/       optional placeholder only if useful
```

Implementation tasks:

- Initialize npm workspaces.
- Scaffold NestJS API.
- Scaffold Vite React app.
- Add Docker Compose services for PostgreSQL, API, and web.
- Add root scripts for dev, migrations, seed, tests, lint, and typecheck.
- Configure TypeScript consistently.

Verification:

- `npm install` succeeds.
- `docker compose up --build` starts all services.
- API health route responds.
- Web dev server loads a minimal placeholder.

Manual audit:

- Confirm the repo shape is simple.
- Confirm Docker is not hiding migrations/seed in surprising startup scripts.
- Confirm no auth/product logic has been prematurely added.

Stop condition:

- Do not proceed until the empty app can run through Docker Compose.

### Phase 1: Prisma Schema, Migration, And Seed

Goal:

- Establish the relational data model and deterministic demo seed.

Expected output:

```text
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/
apps/api/prisma/seed.ts
apps/api/src/prisma/prisma.module.ts
apps/api/src/prisma/prisma.service.ts
```

Implementation tasks:

- Add Prisma to API app.
- Implement enums and models from this plan.
- Create initial migration.
- Implement idempotent seed script.
- Seed users, containers, statuses, tasks, assignees, and grants.

Verification:

- Migration runs against local PostgreSQL.
- Seed runs repeatedly without duplicate data.
- Prisma Studio or SQL inspection shows:
  - 3 users,
  - 1 workspace,
  - 2 spaces,
  - 2 folders,
  - 3 lists,
  - 9 default statuses,
  - at least 15 tasks,
  - grants that create Bob/Carol differences.

Manual audit:

- Confirm seeded hierarchy matches the permission demo.
- Confirm all private descendants are not incorrectly marked public.
- Confirm task/status/list relationships are coherent.

Stop condition:

- Do not build APIs until the seed data is credible and inspectable.

### Phase 2: Backend Foundation

Goal:

- Build the API foundation before domain endpoints.

Expected output:

```text
apps/api/src/main.ts
apps/api/src/common/
apps/api/src/auth/
apps/api/src/users/
```

Implementation tasks:

- Add global validation pipe.
- Add standard error filter.
- Add mock auth guard.
- Add current-user decorator.
- Add `/health`, `/users`, and `/users/me`.
- Ensure routes return consistent errors.

Verification:

- `GET /health` works without auth.
- `GET /users` works with valid `X-User-Id`.
- Missing/invalid user returns `401` with standard error shape.

Manual audit:

- Confirm no JWT/session flow exists.
- Confirm controllers are thin.
- Confirm error shape matches assignment.

Stop condition:

- Do not build domain APIs until auth/error behavior is stable.

### Phase 3: Permission Engine And Container APIs

Goal:

- Implement the hierarchy and permission-filtered tree.

Expected output:

```text
apps/api/src/permissions/
apps/api/src/containers/
```

Implementation tasks:

- Implement `PermissionsService`.
- Implement tree filtering.
- Implement container read/create/update/reorder/archive/delete.
- Implement visibility rules.
- Implement grant list/upsert/delete.
- Enforce admin-only container/status/grant mutations.

Verification:

- Alice tree contains everything.
- Bob and Carol receive visibly different trees.
- Explicit deny hides subtree.
- Member container mutation returns `403`.
- Admin can archive/unarchive and visibility changes update descendants as required.

Manual audit:

- Read the permission service carefully.
- Confirm deny precedence is explicit.
- Confirm frontend will not be required for security.
- Confirm tree output shape is easy for React to render.

Stop condition:

- Do not build task APIs until list access checks are reliable.

### Phase 4: Status And Task APIs

Goal:

- Implement list statuses and task workflows.

Expected output:

```text
apps/api/src/statuses/
apps/api/src/tasks/
```

Implementation tasks:

- Implement status listing and admin status management.
- Implement task list/read/create/update/delete.
- Implement task move and reorder.
- Implement assignee join-table writes while exposing `assigneeIds`.
- Implement pagination.
- Enforce status/list validation.
- Enforce task access through primary list permissions.

Verification:

- Accessible list tasks load with pagination.
- Member can create and update task in accessible list.
- Member cannot read task in denied list.
- Moving task between statuses updates status and position.
- Moving task between lists remaps status by key or falls back to todo.
- In-use status deletion returns `409`.

Manual audit:

- Confirm task APIs are not generic blobs.
- Confirm movement/reorder operations are explicit.
- Confirm all task mutation paths call permission checks.

Stop condition:

- Do not start frontend until focused backend tests pass.

### Phase 5: Focused Backend Tests

Goal:

- Lock the highest-risk backend behavior before UI development.

Expected output:

```text
apps/api/test/
apps/api/src/**/*.spec.ts     if using colocated tests
```

Implementation tasks:

- Add Jest integration test setup.
- Add tests listed in section 11.
- Ensure tests can run in Docker or against local test database.
- Keep fixtures deterministic.

Verification:

- `npm --workspace apps/api run test` passes.
- Tests fail if permission checks are bypassed.
- Tests cover standard `403` behavior.

Manual audit:

- Review test names and assertions.
- Confirm tests cover behavior, not implementation details only.
- Confirm invalid status/list pairing is tested.

Stop condition:

- Backend correctness checkpoint must pass before UI work begins.

### Phase 6: Frontend Shell, API Client, And Sidebar

Goal:

- Build the first frontend vertical slice: user switching and permission-filtered tree.

Expected output:

```text
apps/web/src/api/
apps/web/src/state/
apps/web/src/features/app-shell/
apps/web/src/features/users/
apps/web/src/features/containers/
```

Implementation tasks:

- Add Material UI theme.
- Add TanStack Query provider.
- Add app UI context.
- Implement API client with `X-User-Id`.
- Implement app layout.
- Implement user switcher.
- Implement sidebar tree.
- Implement selected-list state.
- Add loading/error/empty states.

Verification:

- Web app loads through Docker Compose.
- Switching Alice/Bob/Carol reloads tree.
- Selecting a list updates main area placeholder.
- Denied/private differences are visible in sidebar.

Manual audit:

- Confirm server state is in TanStack Query, not copied into global context.
- Confirm user switcher drives real API headers.
- Confirm layout is dense and app-like.

Stop condition:

- Do not build task UI until user switching and tree selection are correct.

### Phase 7: Core Task UI

Goal:

- Build selected-list workflows for kanban, list view, and task drawer.

Expected output:

```text
apps/web/src/features/lists/
apps/web/src/features/tasks/
```

Implementation tasks:

- Fetch statuses and tasks for selected list.
- Implement view tabs.
- Implement kanban columns/cards.
- Implement drag-and-drop status changes and reorder.
- Implement dense list view.
- Implement task drawer create/read/edit/delete.
- Render markdown descriptions.
- Show mutation errors clearly.

Verification:

- Alice can open any list and edit tasks.
- Bob/Carol can edit tasks in accessible lists.
- Kanban drag changes status.
- List view sorting works.
- Task drawer can create, edit, and delete.

Manual audit:

- Confirm drag behavior does not corrupt positions.
- Confirm drawer form state resets correctly between tasks.
- Confirm list and kanban reflect the same backend data.

Stop condition:

- Do not build admin UI until core task workflows work for seeded users.

### Phase 8: Admin Container, Status, And Permission UI

Goal:

- Expose the full MVP admin controls discussed in the decisions.

Expected output:

```text
apps/web/src/features/permissions/
apps/web/src/features/statuses/
apps/web/src/features/containers/
```

Implementation tasks:

- Implement container create/rename/archive/delete dialogs.
- Implement container visibility control.
- Implement simple grant management dialog.
- Implement status settings dialog.
- Add confirmation dialogs for archive/delete.
- Ensure member users do not get admin mutation controls.

Verification:

- Alice can create/rename/archive/delete allowed empty containers.
- Alice can change visibility with validation feedback.
- Alice can allow/deny Bob/Carol on containers.
- Alice can create/rename/recolor/delete unused non-default statuses.
- Members cannot access admin controls or get `403` if attempting direct calls.

Manual audit:

- Confirm UI exposes MVP functionality without becoming an enterprise admin console.
- Confirm dangerous actions require confirmation.
- Confirm backend messages are surfaced.

Stop condition:

- Do not move to final audit until admin workflows are demoable.

### Phase 9: Final Integration Audit

Goal:

- Verify the app is ready for README and demo preparation.

Implementation tasks:

- Run full Docker Compose flow from a clean state.
- Run migration and seed.
- Run backend tests.
- Manually walk through Alice/Bob/Carol demo.
- Fix obvious loading/error/empty state gaps.
- Update README and `AI_USAGE.md` after implementation.

Verification checklist:

- One-command Docker orchestration works.
- Seed data creates meaningful demo content.
- Alice/Bob/Carol trees differ.
- Permission-denied behavior returns `403`.
- Kanban drag works.
- List view works.
- Task drawer works.
- Admin controls work.
- Backend focused tests pass.

Manual audit:

- Confirm no selected deferred features leaked into scope.
- Confirm README trade-offs match actual implementation.
- Confirm demo path is short and reliable.

Stop condition:

- MVP is ready for documentation polish and demo recording.

## 18. Implementation Guardrails For AI-Assisted Development

Use this section as a checklist when asking an AI agent to implement each phase.

General guardrails:

- Give the agent one phase at a time.
- Ask it to stop after the phase verification steps.
- Do not allow unrelated agent-driven refactors during phase work.
- Manual review may intentionally redirect, narrow, or adjust implementation before continuing.
- Keep generated code aligned with this document and `03-ai-audited-final-decisions.md`.
- Prefer explicit service methods over clever abstractions.
- Require tests before frontend work as planned.

Red flags:

- JWT/login appears in MVP code.
- Permissions are checked only in React.
- Task status is stored as a string instead of list-owned status relation.
- Task assignees are stored only as an unvalidated JSON array.
- Public children are allowed under private parents.
- Deny grants do not override allow/public visibility.
- Container mutation is available to members.
- Frontend global context stores full task/tree datasets instead of selection/UI state.
- Docker startup silently resets data without an explicit command.

Acceptable simplifications:

- Client-side list sorting for MVP.
- Basic mutation plus refetch instead of complex optimistic updates.
- Simple status reorder UI or position editing if drag reorder is too costly.
- Hard delete only for tasks.
- Hard delete containers only when empty.
