# Take-Home Assignment: Mini Project

# Management App

**Role:** Lead Engineer — Full Stack
**Time budget:** 3 days (with AI tools allowed)
**Format:** Solo project, public or private Git repo

## Overview

Build **Flowboard** — a mini project-management app for a single team (“workspace”).

A user should be able to:

```
. Organize work in a hierarchy
. Manage tasks inside lists
. View tasks on a kanban board and in a list view
. Control who sees what with a simple permission model
```

Think ClickUp / Asana / Linear at hobby scale.

## Scope & time guidance

```
Day Focus
Day 1 Repo setup, data model, seed script, core REST (or GraphQL) APIs
Day 2 Frontend: sidebar tree + kanban board + task detail panel
Day 3 Permissions, tests, polish, README with architecture notes
```

AI assistants (Cursor, Copilot, ChatGPT, etc.) are **encouraged**. We evaluate **your judgment** , not
typing speed.

## Must-have requirements (MVP)

### 1. Hierarchy (containers)

Model a tree scoped to one workspace:

```
Workspace
└── Space (e.g. "Engineering")
└── Folder (e.g. "Q2 Launch")
└── List (e.g. "Backlog")
└── Tasks
```

**Rules:**

```
Each node has: id, name, type, parentId, position (for sibling ordering)
Valid parent types: workspace → space → folder → list (lists hold tasks, not other containers)
CRUD for each container type
Reorder siblings (drag-and-drop or explicit move API)
Soft-delete or archive (your choice — document it)
```

### 2. Tasks

Each task belongs to exactly **one primary list** and has:

```
Field Required Notes
title Yes Max 500 chars
description No Plain text or markdown
status Yes Must map to a status in the listʼs status set
priority No urgent | high | normal | low | none
assigneeIds No Array of user IDs (mock users are fine)
dueDate No ISO datetime
position Yes Order within status column / list
createdAt / updatedAt Yes
```

**Task operations:**

```
Create, read, update, delete
Move between lists (updates primaryListId)
Change status (updates kanban column)
Reorder within a column
```

**Stretch within MVP if time allows:** one level of subtasks (parentTaskId), max depth 1.

### 3. Status configuration

Each **list** owns a status set. Minimum:

```
todo (not started)
in_progress (active)
done (completed)
```

Statuses have: id, name, category, color, position.

Tasks must only use statuses defined on their list.

### 4. Views (frontend)

Implement **two views** for the selected list:

**A. Kanban board**

```
Columns = statuses for the list
Cards = tasks (title, assignee avatars/initials, priority badge, due date)
Drag card → another column updates status
Drag within column updates position
```

**B. List view**

```
Table or dense list: title, status, assignees, priority, due date
Sort by due date and priority
Click row → task detail drawer/modal
```

**C. Sidebar**

```
Collapsible tree of workspace → spaces → folders → lists
Selecting a list loads its board/list view
```

### 5. Permissions (required — keep it simple)

Support **three mock users** (seed in DB):

```
User Role Expected behavior
Alice admin Sees and edits everything in the workspace
Bob member Sees lists/spaces theyʼre granted access to; can edit tasks in those lists
Carol member Same as Bob, different grants
```

**Permission model (minimum):**

```
Grants attach to a container (space, folder, or list): { resourceId, userId, mode: allow |
deny }
Public containers: visible to all workspace members unless explicitly denied
```

```
Private containers: visible only with an explicit allow grant (admins bypass this)
Tree API returns only nodes the current user can see
Attempting to access a denied resource returns 403
```

You do **not** need team-based grants or complex inheritance — but **document** how you would
extend your model.

### 6. API & auth

```
REST or GraphQL — your choice
JSON request/response bodies
Mock auth: send X-User-Id: alice|bob|carol (or JWT with { userId, role })
Consistent error shape: { error: { code, message } }
Pagination on task list endpoints (cursor or offset)
```

### 7. Persistence

```
Any DB: PostgreSQL, MongoDB, SQLite, etc.
Include a seed script that creates: 1 workspace, 2 spaces, 2 folders, 3 lists, 15 + tasks, 3 users,
sample grants
Migrations or schema definition checked into repo
```

### 8. Tests

Minimum:

```
Backend: unit or integration tests for permission filtering on tree API and task access
Frontend: at least one component test or one E 2 E happy path (Playwright/Cypress — your
choice)
```

### 9. Documentation (README)

Your README is part of the submission. Include:

```
. How to run locally (one command preferred via docker compose up or make dev)
. Architecture diagram (ASCII, Mermaid, or image)
. Data model explanation
. API overview (table or OpenAPI link)
. Trade-offs: what you cut, what youʼd do next in week 2
. AI usage log: tools used and where they helped vs where you corrected them
```

## Nice-to-have (stretch goals)

Pick **at most two** if MVP is solid. Tell us which you attempted in the README.

```
Full-text search on task title/description
Optimistic UI + conflict handling on drag-drop
Activity feed (“Alice moved task X to Done”)
Bulk update (multi-select → change status/assignee)
Real-time updates (WebSocket/SSE)
OpenAPI / Swagger spec
Dockerized deploy to Fly.io/Railway/Render
```

## Technical constraints

```
Topic Guidance
Stack Your choice. Suggested: TypeScript end-to-end (Nest/Fastify/Express + React/Vue/Svelte)
Styling Any UI library or custom CSS — focus on clarity, not pixel perfection
Scope Single workspace, single tenant — no billing, no email, no file uploads
Users Hard-coded mock users — no signup/login flow required
Mobile Desktop-first; responsive is a plus, not required
```

## Deliverables

Submit a link (GitHub/GitLab) containing:

```
. Source code
. README (see section 9 )
. AI_USAGE.md (optional but appreciated) — prompts, corrections, what you rejected from AI
output
. Short demo video ( 3 – 5 min, Loom/YouTube unlisted) walking through: tree navigation, kanban
drag, permission difference between Alice vs Bob
```

**Do not submit:** credentials or API keys (use .env.example).

## FAQ

**Can I use a boilerplate?**
Yes, but strip what you donʼt need and explain your choices.

**Can I skip the frontend and do API-only?**
This assignment is **full stack** — a working UI is required.

**What if I run out of time?**
Ship a working MVP over half-finished stretch goals. Tell us what youʼd do on day 4.

**What stack do you use internally?**
Weʼll discuss our production stack in the interview; use what lets you ship a quality MVP in 3 days.

_Questions? Contact your recruiting coordinator._
