# AI-Audited Final Decisions

This document records the final techno-product decisions for Flowboard after reviewing the assignment requirements and the manual analysis document. It is intended to become the source of truth for the later full-stack implementation plan.

## 1. Product Direction

Flowboard will be implemented as a tightly scoped single-workspace project-management MVP.

The primary goal is complete, reliable coverage of the assignment requirements: hierarchy, list-scoped statuses, task management, kanban/list views, permissions, seed data, tests, and documentation.

The app will optimize for evaluator clarity over production-scale complexity. Architecture and product behavior should be simple, explicit, and defensible. Production concerns that do not affect MVP correctness or the demo will be deferred and documented as trade-offs or week-2 improvements.

The product should feel complete for the intended demo path:

- Switch between Alice, Bob, and Carol.
- See different sidebar trees based on permissions.
- Select a list.
- View tasks in kanban and list views.
- Drag tasks across statuses.
- Open and edit a task.
- Demonstrate denied access returning 403.

Stretch goals will only be attempted after the MVP is stable.

## 2. Scope And Execution Strategy

The implementation will be organized into phases instead of fixed calendar days, so execution can adapt to available schedule while preserving priority.

The goal is to get a core vertical slice working early, then layer workflows, tests, documentation, and polish on top.

### Phase 1: Foundation And Core Backend

- Scaffold the monorepo.
- Define database schema and migrations.
- Seed workspace, users, containers, statuses, tasks, and grants.
- Implement core REST APIs for containers, statuses, tasks, users, and permissions.
- Enforce backend permission checks for tree visibility and task/list access.
- Create a basic frontend shell that can switch current user and load the visible tree.

### Phase 2: Product Workflows

- Implement sidebar tree navigation.
- Implement selected-list workspace with kanban and list views.
- Implement task creation, editing, deletion, status changes, and reordering.
- Implement drag-and-drop for kanban status changes and ordering.
- Implement task detail drawer.
- Implement permission-aware frontend states for Alice, Bob, and Carol.
- Add admin-facing controls only where they directly support the demo and requirements.

### Phase 3: Evaluation Quality

- Add focused backend tests for permission filtering and denied task/list access.
- Add one frontend happy-path E2E test.
- Polish UI states, loading/error handling, and empty states.
- Write README with architecture notes, data model, API overview, trade-offs, and week-2 plan.
- Add AI usage notes.
- Prepare the demo walkthrough.

Phase 3 is not optional because tests, documentation, and demo clarity are part of the evaluated deliverable.

## 3. Stack And Repository Architecture

Flowboard will use TypeScript end-to-end.

Final stack decisions:

- Repository shape: monorepo.
- Backend framework: NestJS with Express.
- API style: REST with JSON request and response bodies.
- Database: PostgreSQL.
- ORM and migrations: Prisma.
- Frontend framework: React with TypeScript.
- Frontend build tooling: Vite.
- UI library: Material UI.
- Kanban drag-and-drop: `@hello-pangea/dnd`.
- Backend tests: Jest.
- Frontend happy-path test: Playwright.

The expected monorepo structure will be:

```text
apps/
  api/
  web/
packages/
  shared/
```

The `packages/shared` workspace is optional at first. It should only be used if shared TypeScript types or constants remove real duplication between backend and frontend.

The implementation should avoid premature infrastructure complexity. Docker Compose is still useful for local PostgreSQL and one-command setup, but the application should remain easy to run locally without hiding important development commands.

## 4. Hierarchy And Containers

Flowboard will model the full assignment hierarchy in one unified `containers` table.

Container types:

- `workspace`
- `space`
- `folder`
- `list`

Strict parent rules:

- `workspace`: `parentId = null`
- `space`: parent must be a `workspace`
- `folder`: parent must be a `space`
- `list`: parent must be a `folder`

The app will strictly enforce `workspace -> space -> folder -> list`. Lists directly under spaces will not be allowed. Lists hold tasks but cannot hold child containers.

Each container will store at least:

- `id`
- `name`
- `type`
- `parentId`
- `position`
- `visibility`
- `isArchived`
- `createdAt`
- `updatedAt`

`visibility` will support public/private behavior for permission checks. `isArchived` will support archive behavior without hard deletion.

Container lifecycle decisions:

- Archive is the primary product behavior for removing containers from normal views.
- Hard delete is supported only for empty accidental creates in MVP.
- Hard delete of non-empty containers should be blocked with a clear error; archive should be used instead.
- Archive and delete actions require confirmation.
- Archived containers are hidden by default in the sidebar.
- A small "show archived" toggle may reveal archived containers where useful.
- Archiving a container hides its subtree from normal views.

Container mutation permissions:

- Admin users can create, rename, reorder, archive, and delete all container types, subject to the lifecycle rules above.
- Member users can only view containers they are allowed to access.
- Member users cannot create, rename, reorder, archive, or delete containers.
- Member users can create, update, delete, move, and reorder tasks inside lists they can access.

Workspace-specific behavior:

- Workspace is stored as a `workspace` row in `containers`.
- Workspace-level permissions are supported by the same grant model for consistency.
- All seeded users are workspace members.
- Admin users may rename the workspace.
- Workspace delete is not part of the MVP UI because it would destroy demo data.
- If workspace delete is implemented at API level, it must be admin-only, explicitly destructive, and treated as a development/reset utility rather than a normal product workflow.

Task and status references:

- `tasks.primaryListId` must reference a `list` container.
- `statuses.listId` must reference a `list` container.
- Backend validation will reject task/status operations against non-list containers.

Reordering and moving:

- Sibling reorder is required and will be supported.
- Sibling positions should be unique within the same parent.
- Moving containers to a different parent is allowed only when the resulting hierarchy remains valid.
- If cross-parent moves create too much implementation risk, the MVP will prioritize sibling reorder and document cross-parent container move as a week-2 improvement.

## 5. Tasks

Each task belongs to exactly one primary list.

Task fields will follow the assignment requirements:

- `id`
- `title`
- `description`
- `statusId`
- `priority`
- `assigneeIds`
- `dueDate`
- `position`
- `primaryListId`
- `createdAt`
- `updatedAt`

Task validation decisions:

- `title` is required and has a maximum length of 500 characters.
- `description` is optional.
- `statusId` must reference a status defined on the task's primary list.
- `priority` supports `urgent`, `high`, `normal`, `low`, and `none`.
- `assigneeIds` can contain seeded mock user IDs.
- `dueDate` is optional and stored as an ISO datetime.
- `primaryListId` must reference a `list` container.
- Priority sort order is `urgent`, `high`, `normal`, `low`, then `none`.
- The API exposes assignees as `assigneeIds`.
- The database will store assignees with a task-user join table to preserve relational integrity while keeping the API shape required by the assignment.

Task operations:

- Create, read, update, and delete tasks.
- Move tasks between lists by updating `primaryListId`.
- Change task status by updating `statusId`.
- Reorder tasks within a status column.

Task delete behavior:

- Tasks will use hard delete only.
- Task delete requires confirmation in the UI.
- Task archive will not be implemented for MVP.

Task ordering:

- `position` is scoped within the pair of `primaryListId` and `statusId`.
- Task positions should be unique within the same `primaryListId` and `statusId`.
- Reordering within a kanban column updates positions for tasks in that list/status.
- Moving a task to another status recalculates its position in the target status column.
- Moving a task to another list recalculates its position in the target list/status.

Moving tasks between lists:

- The target list's status set is authoritative.
- If the task's current status key exists in the target list, the task may use the matching target status.
- If the current status key does not exist in the target list, the task will be assigned to the target list's default `todo` status.
- Backend validation will reject any task update that assigns a status not defined on the task's primary list.

Subtasks:

- One level of subtasks is deferred from MVP.
- Subtasks may be attempted after Phase 2 if the core MVP is stable.
- If not implemented, subtasks will be documented as a stretch/week-2 improvement.

## 6. Status Configuration

Each list owns its own status set.

Minimum default statuses for every list:

- `todo`
- `in_progress`
- `done`

Status fields:

- `id`
- `listId`
- `key`
- `name`
- `category`
- `color`
- `position`
- `isDefault`
- `createdAt`
- `updatedAt`

Status data model decisions:

- Statuses are stored in a dedicated `statuses` table.
- `listId` must reference a `list` container.
- Tasks store `statusId` directly on the `tasks` table.
- There will be no task-status join table because each task has exactly one current status.
- Backend validation will enforce that a task's `statusId` belongs to the task's `primaryListId`.
- If cleanly supported by Prisma/PostgreSQL, a database-level composite constraint may also enforce that status/list pairing.
- Each list must have unique status keys.
- Each list must have unique status positions.

Status identity:

- `key` is the stable status identifier, such as `todo`, `in_progress`, or `done`.
- `name` is the display label shown in the UI.
- `category` follows the assignment naming and will use `todo`, `in_progress`, and `done`.
- `color` will be stored as a hex string.
- `position` controls column ordering in kanban and status ordering in list view.

Default status behavior:

- New lists automatically receive `todo`, `in_progress`, and `done`.
- Default statuses are non-deletable.
- Admin users may rename or recolor statuses if needed.
- The default `todo` status is used when a moved task cannot keep a matching status in the target list.

Status management permissions:

- Admin users can create, rename, recolor, reorder, and delete non-default statuses.
- Member users cannot manage status configuration.
- Member users can update task status inside lists they can access.

Status deletion rules:

- A status cannot be deleted if any task in the list currently uses it.
- The API will return a consistent error response explaining that the status is in use and must be emptied before deletion.
- The UI should surface this response clearly instead of silently failing.

## 7. Permissions

Flowboard will support the three seeded mock users from the assignment:

- Alice: `admin`
- Bob: `member`
- Carol: `member`

Permission model:

- Grants attach to containers.
- A grant has `{ resourceId, userId, mode }`.
- `resourceId` references `containers.id`.
- `mode` is `allow` or `deny`.
- Containers have `visibility`: `public` or `private`.
- A user should have at most one grant per container.

Role behavior:

- Admin users bypass permission checks.
- Admin users can see and edit everything in the workspace.
- Member users only see containers they are allowed to see.
- Member users can edit tasks inside lists they can access.
- Member users cannot mutate containers, status configuration, or permission grants.

Backend enforcement:

- Permission checks are enforced on the backend for every protected API.
- Frontend hiding or disabling controls is not treated as security.
- Unauthorized access returns the standard 403 error shape.

Tree visibility rules:

- The tree API returns only nodes the current user can see.
- A member can see a public container only if all ancestors are visible and no explicit deny blocks the path.
- A member can see a private container only with an explicit allow and a visible ancestor path.
- If a member cannot see a parent, descendants are hidden as well.
- This avoids orphaned folders/lists in the sidebar.

Deny precedence:

- Explicit `deny` always overrides public visibility and explicit `allow`.
- A `deny` on any container in the path from workspace to the requested resource blocks access to that resource.
- A parent `deny` hides the subtree even if a descendant has an explicit `allow`.
- Admin users bypass deny rules.

Public/private consistency:

- A container can be public only if all ancestors are public.
- A child under a private parent cannot be made public.
- Backend validation rejects attempts to make a child public under a private parent.
- The UI should disable this control and explain the reason when relevant.

Changing visibility:

- Only admin users can change container visibility.
- When a container is changed from public to private, all descendant containers are also changed to private in the same transaction.
- This operation does not automatically create `allow` grants.
- Existing explicit grants remain unchanged.
- Admin users must explicitly grant access after making a container private.
- Granting access to a nested private container requires a visible path through its ancestors. In practice, this means the user needs access to each private ancestor, or access should be granted at an ancestor level.
- Making a container public is allowed only when all ancestors are public.
- Making a container public does not automatically make descendants public.

Permission UI:

- Admin users can manage grants for containers.
- Member users can see disabled container/permission controls where useful.
- Disabled controls should show a tooltip such as "Only admins can perform this action."
- Permission UI should be simple and demo-focused: enough to grant or deny Bob/Carol access to containers without building a full enterprise access-control system.

Task access:

- Task access is derived from access to the task's primary list.
- A member can create, read, update, delete, move, and reorder tasks only inside lists they can access.
- Attempting to access a task in a denied or hidden list returns 403.

## 8. API And Auth

API style:

- Flowboard will use REST APIs.
- Request and response bodies will be JSON.
- API behavior should be explicit and easy to inspect during the demo.

Mock auth:

- The app will use `X-User-Id: alice|bob|carol`.
- The backend will resolve the user from this header on every request.
- Missing or unknown users return an authentication error.
- JWT authentication will not be implemented for MVP.
- JWT/auth hardening can be documented as a week-2 improvement.

Error shape:

- All API errors will use a consistent response shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

Important error cases:

- `401` for missing or invalid mock user.
- `403` for permission denied.
- `404` for missing resources.
- `400` for validation errors.
- `409` for conflicts such as deleting a status that is still used by tasks.

Pagination:

- Task list endpoints will use offset pagination.
- Query parameters: `limit` and `offset`.
- Responses should include task rows and enough pagination metadata for the frontend.

Primary route groups:

- `/users`
- `/containers`
- `/statuses`
- `/tasks`

Route behavior:

- `/users` returns the seeded mock users for the user switcher.
- `/containers/tree` returns the permission-filtered workspace tree for the current user.
- Container mutation routes are admin-only.
- Status configuration routes are admin-only except status reads needed for accessible lists.
- Task routes enforce access through the task's primary list.
- Move/reorder APIs should be explicit rather than hidden inside ambiguous generic updates.

## 9. Persistence And Seed Data

Database:

- Flowboard will use PostgreSQL.
- Prisma will define the schema, migrations, and seed flow.
- Docker Compose will be used for local PostgreSQL setup.
- The README should support a one-command local start where practical.

Primary keys:

- Seeded users use stable string IDs: `alice`, `bob`, and `carol`.
- The `X-User-Id` auth header directly references `users.id`.
- Containers, statuses, tasks, grants, and other app entities use UUID primary keys through Prisma/PostgreSQL.
- UUIDs avoid order assumptions and are stable for frontend/API references.

Required seed data:

- 1 workspace.
- 2 spaces.
- 2 folders.
- 3 lists.
- At least 15 tasks.
- 3 users: Alice, Bob, and Carol.
- Sample grants.

Seed data goals:

- Alice can see and edit everything as admin.
- Bob and Carol should have visibly different access.
- Seed data should include public containers.
- Seed data should include at least one private container.
- Seed data should include at least one explicit deny.
- Seed data should make the permission-filtered sidebar differences obvious during the demo.

Seeded statuses:

- Every seeded list receives `todo`, `in_progress`, and `done`.
- Seeded tasks should be distributed across statuses so the kanban board is visually meaningful.

Seeded tasks:

- Tasks should include varied priorities.
- Some tasks should have assignees.
- Some tasks should have due dates.
- Descriptions can be short plain text or markdown.

Migration and reset:

- Schema definition and migrations will be checked into the repo.
- A seed command will recreate the required demo data.
- The project should provide a straightforward way to reset local data during development.

## 10. Frontend Views And UX

Frontend priorities:

- The UI should make the required workflows clear and demoable.
- The app should feel like a small project-management tool, not a generic admin table.
- Desktop-first layout is acceptable, with basic responsive behavior where practical.

Global layout:

- A left sidebar shows the workspace tree.
- The main area shows the selected list.
- A top-right user switcher allows switching between Alice, Bob, and Carol.
- Switching users reloads permission-filtered data and demonstrates visibility differences.

Sidebar:

- The sidebar renders `workspace -> space -> folder -> list`.
- The tree is collapsible.
- Selecting a list loads its kanban/list views.
- Archived containers are hidden by default.
- Admin users see container actions such as create, rename, reorder, archive, delete, visibility, and permissions where implemented.
- Member users cannot mutate containers.
- Disabled controls for members should show a tooltip such as "Only admins can perform this action" where the disabled state improves clarity.
- Controls may be hidden instead of disabled where showing them would create unnecessary clutter.

Selected list workspace:

- The selected list will support two views:
  - Kanban board.
  - Dense list view.
- View switching should be obvious and lightweight, such as tabs or segmented controls.

Kanban board:

- Columns are the selected list's statuses.
- Cards are tasks.
- Cards show title, assignee avatars/initials, priority badge, and due date.
- Dragging a card to another column updates task status.
- Dragging within a column updates task position.
- Kanban drag-and-drop will use `@hello-pangea/dnd`.

List view:

- List view will be a dense task list, not a traditional data table.
- Each row shows title, status chip, assignee avatars/initials, priority badge, due date, and compact action buttons where useful.
- Sorting by due date and priority will be provided through compact toolbar controls.
- Clicking a row opens the task detail drawer.

Task detail:

- Task details open in a right-side drawer.
- Task creation and editing happen in the drawer.
- Inline row editing is deferred from MVP.
- The drawer supports editing title, description, status, priority, assignees, and due date.
- Delete requires confirmation.

Task description:

- Task descriptions are stored as text.
- Markdown viewing will be supported in MVP using `react-markdown`.
- The drawer should allow editing markdown text and viewing the rendered result.
- Raw HTML inside markdown should not be enabled for MVP.
- Seed data should include markdown descriptions so the demo shows this capability.

Admin-only frontend behavior:

- Container, status configuration, visibility, and permission controls are admin-only.
- Member users can still create, update, delete, move, and reorder tasks inside accessible lists.
- The frontend should make this difference visible without relying on the frontend for enforcement.

## 11. Tests

Testing will focus on the highest-risk assignment requirements.

Backend tests:

- Use Jest.
- Prefer integration-style tests around service/API behavior.
- Cover permission filtering on the tree API.
- Cover denied access returning 403 for task/list access.
- Cover admin bypass behavior.
- Cover member task mutation inside an accessible list.
- Cover rejection when assigning a task to a status outside its primary list.

Frontend test:

- Use Playwright for one happy-path E2E test.
- The happy path should cover:
  - Load the app.
  - Switch between seeded users.
  - Select a visible list.
  - View kanban/list data.
  - Open the task detail drawer.
  - Perform one task update or drag action if stable in automation.

Test scope decisions:

- The MVP will not attempt exhaustive CRUD coverage for every endpoint.
- Permission behavior and the main UI workflow are more important for evaluation.
- Broader endpoint, component, and edge-case coverage will be documented as week-2 improvements.

## 12. Documentation And Deliverables

README:

- `README.md` is a required deliverable and should be treated as part of the product.
- It must explain how to run the project locally.
- One-command startup should be supported where practical, likely through Docker Compose plus app commands.
- It should include architecture notes, data model explanation, API overview, trade-offs, and week-2 improvements.

Architecture documentation:

- Use Mermaid diagrams for architecture and data model where useful.
- Include a concise explanation of the monorepo structure.
- Explain why the project uses TypeScript, NestJS, React, PostgreSQL, Prisma, Material UI, and Playwright.

API documentation:

- Use a table-based API overview for MVP.
- Document route group, method, path, purpose, and permission behavior.
- Full OpenAPI/Swagger is not required for MVP.
- OpenAPI/Swagger can be attempted later only if the MVP and selected stretch goals are stable.

AI usage:

- Create `AI_USAGE.md`.
- Record the major ways AI helped: planning, implementation scaffolding, debugging, tests, and documentation.
- Record areas where human judgment corrected or constrained AI output.
- Keep the AI usage log concise and credible.

Trade-offs:

- README should explicitly explain what was intentionally deferred.
- Trade-offs should be framed as scoped MVP decisions, not unfinished accidents.
- Week-2 improvements should include production auth, broader tests, real-time updates, deeper permission tooling, and deployment polish if not implemented.
- Activity feed should be listed as a week-2 improvement only if the selected stretch goal is not implemented.

Demo:

- Prepare a 3-5 minute walkthrough.
- The demo should show:
  - Tree navigation.
  - Kanban drag.
  - List view.
  - Task drawer and markdown description rendering.
  - Alice vs Bob/Carol permission differences.
  - A denied action or 403 behavior where practical.

## 13. Stretch Goals

Stretch goals will only be attempted after the MVP is stable.

The assignment asks to pick at most two nice-to-have goals. Flowboard's selected stretch goals are:

1. Dockerized deploy to Fly.io, Railway, or Render.
2. Activity feed.

Dockerized deploy:

- Provides breadth beyond local development.
- Demonstrates production-oriented packaging and environment handling.
- Should not block core local development or the required demo.

Activity feed:

- Improves product usability by making task changes visible.
- Can capture actions such as task creation, status changes, assignment changes, and deletion.
- Should be simple and scoped, not a full audit-log system.

Non-committed opportunistic improvements:

- OpenAPI/Swagger spec.
- Full-text search on task title/description.

These opportunistic improvements are not official selected stretch goals. They may be implemented only if the MVP and the two selected stretch goals are complete. If not implemented, they should be listed as week-2 enhancements.

## 14. Explicit Non-Goals And Week-2 Enhancements

The MVP will intentionally defer features that are not required for the assignment or selected stretch goals.

Deferred items:

- Real signup/login flow.
- Production JWT/session auth.
- Team-based grants or group permissions.
- Billing.
- Email notifications.
- File uploads.
- Real-time updates with WebSocket/SSE.
- Exhaustive test coverage for every CRUD endpoint.
- Complex enterprise permission inheritance UI.
- Subtasks, unless Phase 2 is completed early enough to add them safely.
- OpenAPI/Swagger spec, unless there is time after MVP and selected stretch goals.
- Full-text search on task title/description, unless there is time after MVP and selected stretch goals.

These items should be described in README as intentional scope decisions or week-2 enhancements rather than incomplete MVP requirements.
