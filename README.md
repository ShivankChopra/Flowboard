# Flowboard

Flowboard is a single-workspace project-management MVP built for the take-home assignment. It models a small ClickUp/Asana-style workspace with a permission-filtered hierarchy, list-owned statuses, task workflows, a kanban board, and a dense list view.

The app is intentionally scoped for evaluator clarity: one workspace, three seeded users, mock header-based auth, explicit REST APIs, checked-in PostgreSQL migrations, and focused tests around the riskiest behavior.

Feel free to checkout live demo hosted on Render here -> https://flowboard-rzw6.onrender.com

Short youtube video demo showcasing basic navigations, permissions, etc -> https://youtu.be/_k-0cnKOBT4  

## Table Of Contents

- [What Is Included](#what-is-included)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Run Locally](#run-locally)
- [Seeded Demo Data](#seeded-demo-data)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Permissions](#permissions)
- [API Overview](#api-overview)
- [Tests](#tests)
- [Stretch Goals Completed](#stretch-goals-completed)
- [Trade-Offs And Week-2 Work](#trade-offs-and-week-2-work)
- [AI Usage](#ai-usage)

## What Is Included

- Workspace hierarchy: `workspace -> space -> folder -> list -> tasks`.
- Container CRUD, archive/unarchive, hard delete for empty containers, and admin drag/reorder/move.
- List-owned statuses with default `todo`, `in_progress`, and `done` statuses.
- Task CRUD, assignees, priority, due date, status changes, list/status moves, and column ordering.
- Kanban board with draggable task cards.
- Dense list view with priority/due-date sorting, pagination, search, and task detail drawer.
- Permission-filtered sidebar for Alice, Bob, and Carol.
- Admin UI for container settings, grants, visibility, archive/delete, and list status settings.
- Mock auth through `X-User-Id: alice|bob|carol`.
- Consistent API error shape: `{ "error": { "code": "...", "message": "..." } }`.
- Docker Compose local setup with automatic migration deploy and demo seeding.
- Backend integration tests and one Playwright happy-path E2E test.

## Tech Stack

| Area           | Choice                              |
| -------------- | ----------------------------------- |
| Repository     | npm workspaces monorepo             |
| Backend        | NestJS, Express adapter, TypeScript |
| Frontend       | React, Vite, TypeScript             |
| UI             | Material UI                         |
| Server state   | TanStack Query                      |
| Database       | PostgreSQL                          |
| ORM/migrations | Prisma                              |
| Tests          | Jest for API, Playwright for E2E    |
| Local runtime  | Docker Compose                      |

## Repository Structure

```text
flowboard/
  apps/
    api/              NestJS API, Prisma schema, migrations, seed flow, tests
    web/              React/Vite frontend and Playwright E2E test
  docs/               Planning and assignment context
  docker-compose.yml  Local Postgres/API/web orchestration
  Dockerfile          Dev targets and production image target
```

## Run Locally

Prerequisites:

- Docker Desktop or a compatible Docker Compose runtime.
- Node.js 22+ and npm 10+ for local scripts.

Setup:

```bash
cp .env.example .env
npm run dev
```

Open:

- Web app: `http://localhost:5173`
- API health: `http://localhost:3000/health`

The default `.env.example` enables demo seeding:

```text
ENABLE_DEMO_SEED=true
```

With `npm run dev`, the API container waits for Postgres, runs `prisma migrate deploy`, starts Nest, and then seeds the demo data when `ENABLE_DEMO_SEED=true`. Demo seeding resets the seeded workspace on API startup, which keeps evaluation deterministic. Set `ENABLE_DEMO_SEED=false` if you want local edits to survive container restarts.

Useful commands:

| Command                     | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `npm run dev`               | Build and start Postgres, API, and web through Docker Compose |
| `npm run dev:db`            | Start only Postgres                                           |
| `npm run dev:api`           | Run API locally outside Docker                                |
| `npm run dev:web`           | Run web locally outside Docker                                |
| `npm run db:migrate:deploy` | Apply checked-in migrations non-interactively                 |
| `npm run db:seed`           | Reset and seed demo data manually                             |
| `npm run test:api`          | Run backend Jest tests                                        |
| `npm run test:e2e`          | Run Playwright happy-path test                                |

## Seeded Demo Data

Users:

| User                   | Role     | Notes                                                                       |
| ---------------------- | -------- | --------------------------------------------------------------------------- |
| Alice Morgan (`alice`) | `admin`  | Sees and edits everything                                                   |
| Bob Chen (`bob`)       | `member` | Can access Engineering/Q2 Launch, including private Web App; denied Product |
| Carol Diaz (`carol`)   | `member` | Can access Product/Customer Feedback/Research Queue; denied Web App         |

Seeded hierarchy:

```text
Flowboard Workspace
+-- Engineering                     public
|   +-- Q2 Launch                   public
|       +-- Backend Backlog         public
|       +-- Web App                 private
+-- Product                         public
    +-- Customer Feedback           private
        +-- Research Queue          private
```

The seed creates 1 workspace, 2 spaces, 2 folders, 3 lists, default statuses for each list, 15 tasks, 3 users, and sample allow/deny grants.

## Architecture

```text
Browser
  |
  | React + Vite + MUI
  | TanStack Query adds X-User-Id to API calls
  v
NestJS REST API
  |
  | Auth guard resolves X-User-Id
  | Services enforce hierarchy, status, task, and permission rules
  v
Prisma Client
  |
  v
PostgreSQL
```

Runtime flow:

```text
npm run dev
  -> docker compose up --build
      -> postgres healthcheck
      -> api: prisma migrate deploy
      -> api: Nest start
      -> api: demo seed if ENABLE_DEMO_SEED=true
      -> web: Vite dev server
```

## Data Model

```text
+-------------------+        +-------------------+
| users             |        | grants            |
|-------------------|        |-------------------|
| id PK             |<-------| userId FK         |
| name              |        | resourceId FK     |------+
| role              |        | mode allow/deny   |      |
| createdAt         |        | createdAt         |      |
| updatedAt         |        | updatedAt         |      |
+-------------------+        +-------------------+      |
        ^                                                |
        |                                                v
+-------------------+        +-------------------+   +-------------------+
| task_assignees    |        | tasks             |   | containers        |
|-------------------|        |-------------------|   |-------------------|
| taskId PK/FK      |------->| id PK             |   | id PK             |
| userId PK/FK      |        | title             |   | name              |
| createdAt         |        | description       |   | type              |
+-------------------+        | priority          |   | parentId FK self  |
                             | dueDate           |   | position          |
                             | position          |   | visibility        |
                             | primaryListId FK  |-->| isArchived        |
                             | statusId FK       |   | createdAt         |
                             | createdAt         |   | updatedAt         |
                             | updatedAt         |   +-------------------+
                             +-------------------+            ^
                                      |                       |
                                      v                       |
                             +-------------------+            |
                             | statuses          |            |
                             |-------------------|            |
                             | id PK             |            |
                             | listId FK         |------------+
                             | key               |
                             | name              |
                             | category          |
                             | color             |
                             | position          |
                             | isDefault         |
                             | createdAt         |
                             | updatedAt         |
                             +-------------------+
```

Relationship summary:

- `containers.parentId -> containers.id` stores the workspace tree.
- `grants.resourceId -> containers.id` and `grants.userId -> users.id` store explicit allow/deny grants.
- `statuses.listId -> containers.id` stores each list's status set.
- `tasks.primaryListId -> containers.id` stores the task's owning list.
- `tasks.statusId -> statuses.id` stores the task's current status.
- `task_assignees.taskId -> tasks.id` and `task_assignees.userId -> users.id` store task assignees.

Important rules enforced in services:

- Valid container hierarchy is strict: workspace contains spaces, spaces contain folders, folders contain lists.
- Lists hold tasks and statuses; lists cannot contain child containers.
- Sibling container positions are ordered under the same parent.
- Task position is scoped to `(primaryListId, statusId)`.
- Every task status must belong to the task's primary list.
- Moving a task to another list keeps the matching status key when available, otherwise it uses the target list's `todo` status.
- Default statuses cannot be deleted.
- Non-default statuses cannot be deleted while tasks still use them.
- Containers are archived for soft-delete behavior; hard delete is only allowed for empty non-workspace containers.
- Changing a container to private cascades private visibility to descendants.
- A public container is rejected under a private ancestor.

## Permissions

Auth is intentionally mocked. Every protected API request sends:

```text
X-User-Id: alice
```

Permission model:

- Admin users bypass visibility and grants.
- Member users can see public containers unless denied.
- Private containers require explicit allow grants.
- Grants attach to containers and use `allow` or `deny`.
- A deny on a container or ancestor overrides public visibility and descendant allows.
- A member allowed to a nested private container can see the direct ancestor path needed to reach it, but not unrelated siblings.
- Members can create, update, delete, move, and reorder tasks inside lists they can access.
- Members cannot mutate containers, grants, visibility, or status configuration.

How this would extend in week 2:

- Add team/group grants with user membership tables.
- Add role-specific grant modes such as `view`, `comment`, `edit`, and `manage`.
- Add explicit workspace membership instead of relying on seeded users.
- Add an audit log for grant and visibility changes.
- Cache or precompute permission paths if the workspace grows beyond the current single-team scale.

## API Overview

All protected routes require `X-User-Id`. Common failure codes are:

- `401 AUTH_REQUIRED` or `INVALID_USER`
- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 NOT_FOUND`
- `409 CONFLICT`
- `500 INTERNAL_SERVER_ERROR`

### Health

| Method | Path      | Auth | Purpose      | Success | Common failures |
| ------ | --------- | ---- | ------------ | ------- | --------------- |
| `GET`  | `/health` | No   | Health check | `200`   | `500`           |

### Users

| Method | Path        | Auth | Purpose                            | Success | Common failures |
| ------ | ----------- | ---- | ---------------------------------- | ------- | --------------- |
| `GET`  | `/users`    | Yes  | List seeded users for the switcher | `200`   | `401`           |
| `GET`  | `/users/me` | Yes  | Return resolved current user       | `200`   | `401`           |

### Containers

| Method   | Path                                     | Auth  | Purpose                                      | Success | Common failures                   |
| -------- | ---------------------------------------- | ----- | -------------------------------------------- | ------- | --------------------------------- |
| `GET`    | `/containers/tree?includeArchived=false` | Yes   | Permission-filtered hierarchy                | `200`   | `401`                             |
| `GET`    | `/containers/:id`                        | Yes   | Read a visible container                     | `200`   | `401`, `403`, `404`               |
| `POST`   | `/containers`                            | Admin | Create space, folder, or list                | `201`   | `400`, `401`, `403`, `404`        |
| `PATCH`  | `/containers/:id`                        | Admin | Rename or change visibility                  | `200`   | `400`, `401`, `403`, `404`        |
| `POST`   | `/containers/:id/reorder`                | Admin | Reorder siblings or move to a valid parent   | `201`   | `400`, `401`, `403`, `404`        |
| `PATCH`  | `/containers/:id/archive`                | Admin | Archive or restore a subtree                 | `200`   | `401`, `403`, `404`               |
| `DELETE` | `/containers/:id`                        | Admin | Hard-delete an empty non-workspace container | `204`   | `401`, `403`, `404`, `409`        |
| `GET`    | `/containers/:id/grants`                 | Admin | List explicit grants for a container         | `200`   | `401`, `403`, `404`               |
| `PUT`    | `/containers/:id/grants/:userId`         | Admin | Upsert allow/deny grant                      | `200`   | `400`, `401`, `403`, `404`, `409` |
| `DELETE` | `/containers/:id/grants/:userId`         | Admin | Remove explicit grant                        | `204`   | `401`, `403`, `404`               |

### Statuses

| Method   | Path                       | Auth  | Purpose                                             | Success | Common failures                   |
| -------- | -------------------------- | ----- | --------------------------------------------------- | ------- | --------------------------------- |
| `GET`    | `/statuses?listId=:listId` | Yes   | List statuses for an accessible list                | `200`   | `400`, `401`, `403`, `404`        |
| `POST`   | `/statuses`                | Admin | Create a custom list status                         | `201`   | `400`, `401`, `403`, `404`, `409` |
| `PATCH`  | `/statuses/:id`            | Admin | Rename, recolor, recategorize, or reposition status | `200`   | `400`, `401`, `403`, `404`        |
| `DELETE` | `/statuses/:id`            | Admin | Delete an unused non-default status                 | `204`   | `401`, `403`, `404`, `409`        |

### Tasks

| Method   | Path                                                                     | Auth | Purpose                                    | Success | Common failures            |
| -------- | ------------------------------------------------------------------------ | ---- | ------------------------------------------ | ------- | -------------------------- |
| `GET`    | `/tasks?listId=:listId&limit=50&offset=0&sort=position&direction=asc&q=` | Yes  | Paginated task list with optional search   | `200`   | `400`, `401`, `403`, `404` |
| `GET`    | `/tasks/:id`                                                             | Yes  | Read task detail                           | `200`   | `401`, `403`, `404`        |
| `POST`   | `/tasks`                                                                 | Yes  | Create task in an accessible list          | `201`   | `400`, `401`, `403`, `404` |
| `PATCH`  | `/tasks/:id`                                                             | Yes  | Update task fields                         | `200`   | `400`, `401`, `403`, `404` |
| `POST`   | `/tasks/:id/move`                                                        | Yes  | Move task across status/list and position  | `201`   | `400`, `401`, `403`, `404` |
| `POST`   | `/tasks/reorder`                                                         | Yes  | Rewrite task order for one or more columns | `204`   | `400`, `401`, `403`, `404` |
| `DELETE` | `/tasks/:id`                                                             | Yes  | Hard-delete task                           | `204`   | `401`, `403`, `404`        |

## Tests

Backend tests live in `apps/api/test/permissions-and-tasks.spec.ts` and cover:

- Permission-filtered tree behavior for Alice, Bob, and Carol.
- Denied task/container/grant access returning `403`.
- Admin bypass.
- Container move/reorder validation.
- Member task create/update/delete inside accessible lists.
- Rejection of task status/list mismatches.
- In-use status deletion returning `409`.

Frontend E2E lives in `apps/web/e2e/flowboard-happy-path.spec.ts` and covers a happy path where Alice creates a private hierarchy for Bob, Bob creates and moves a task, and Carol cannot see Bob's private list.

Run:

```bash
npm run test:api
npm run test:e2e
```

For Playwright, keep the app running with `npm run dev` first.

## Stretch Goals Completed

| Stretch goal                               | Status                                                                                                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-text search on task title/description | Implemented in the task list endpoint with PostgreSQL full-text search plus `ILIKE` fallback matching, exposed in the list view search box                     |
| Dockerized deploy to Render host           | Production Docker target added; Nest serves the built web app from the same container when `apps/web/dist` exists. Link -> https://flowboard-rzw6.onrender.com |

## Trade-Offs And Week-2 Work

Intentional MVP trade-offs:

- No signup, login, JWT, sessions, or password flow.
- No team/group grants; permissions are user-to-container grants only.
- No subtasks.
- No real-time updates.
- No activity feed.
- No bulk update.
- No OpenAPI/Swagger document.
- No exhaustive CRUD test matrix.
- Drag-and-drop uses browser-native drag events rather than a dedicated drag library.
- Demo seed resets data when enabled; this is good for evaluation but not for preserving local edits.

Week-2 improvements:

- Replace mock auth with production auth and workspace membership.
- Add OpenAPI/Swagger and generated API clients.
- Add activity feed for task moves, edits, and permission changes.
- Add WebSocket or SSE updates for collaborative use.
- Add optimistic UI with conflict handling for drag/drop.
- Add subtasks with explicit max-depth enforcement.
- Add deployment manifest files and environment-specific seed/migration controls.

## AI Usage

AI tools were used during planning, implementation support, debugging, and documentation drafting. The detailed AI usage log is kept separately in `AI_USAGE.md`.
