Section by section analysis and comments on 01-task-requirements.md file

## Overview

1. Since it is hobby scale - main approach will be to satisfy all requirements as required in minimal possible way - including cutting corners for extra durability and reliability, but delivering all that is mentioned flawlessly.
2. So may cut corners - like no over indexing in DBs, keeping things lean.
3. But must cover all requirements so that the product usage feels as required.
4. Among optional features, nice to have features, we will try to chose features that can give highest ROI considering they are evaluating decision making.
5. For technologies, I am thinking using PostgreSQL, Nest.js with express for backend and react + typescript on frontend.

## Scope and timing Guidance

1. We will try to finish dev and MVP complete in day 1.
2. In day 2, we will do polishing, proper testing, documentation. If few features not present can be squeezed in, will try to do that.
3. Aim is to finish early in a strong way - leave 3rd day for emergency case if dev spills over.
4. Will try to follow the requirements in a very scoped way.

## Must have requirements

### Hierarchy (containers)

1. We will add feature for archive. So in DB we must have status field to save it, and UI button along with API for archiving.
2. Obviously we need to store nodes in db, for hobby scale, we can have a single DB with redundant fields to accommodate Workspace, Space, Folder and List separated by type in a single table called containers.
3. It can be handled simply as a singular entity type (node) in UI also, no multiple APIs, and we can make API in such a way that it formats and returns json in nested array formats for easy rendering.
4. DB fields are self explanatory from rules, must check if more fields might be needed.
5. For CRUD
    1. Updates - We should be able to update name (have a small ‘pencil’ icon button over name to edit it inline), position (by dragging/move API), parentId (also by dragging, for eg. lets say move folders between space).
    2. Updates may not require confirmation, but archiving and deleting should.
    3. Archiving should simply make the section not countable in Workspace stats, or something like that. We can hide archived items, until user clicks small show/hide archived toggle button near parent container.
    4. We can leave API layer out of it, just have archived items also on UI, just dont render them based on toggle archived button.
    5. Deleting deletes completely from DB. Can help with accidental creates as well.
6. The rule that only list can hold tasks will be made ensuring only list-type containers are ever used on backend for storing primaryListId in Tasks.

### Tasks

1. containers table and task table will have 1:many relation, which can be established by primaryListId.
2. We have well defined schema structure for tasks table in requirements docs.
3. Create task button can be present in both list, as well as on right side in list view and even in kanban view. When created from list view, either a modal can be opened, or rightmost drawer based detailed task view can be used (TBD later). While creating from kanban column or grouped status header (in central view), we can have preset status on UI, rest APIs used is same.
4. If we only store primaryListId in tasks, we would have to do either joins in backend, or hit multiple APIs per list to get from server, which feels bad. Either we can also store workspace ids in all children containers as well as task as extra field - need to debate this.
5. Updating task is simple - open elected right drawer, clicking edit changes mode to edit, user make changes and click save to save all.
6. Delete should again require confirmation. Lets not have archiving in tasks.
7. I think we can add a simple list of subtasks (checkbox based rendered similar to trello), for each task optionally. It can track position, description, and status (pending|completed) only. I think storing as json array in tasks is tempting, but a separate table will be much cleaner. We can use power of SQL to form desired responses straight from query only.

### Status configuration

1. We can have a table ‘list_status_set’ that always have default - todo, in_progress and done statuses on list creation.
2. DB fields are self explanatory from requirement doc. Should have parentListId referencing container id. The backend code should ensure that container queries always have a preset of type: ‘list’ - for double safety that we touch only list-containers items for queries.
3. Lets store string hex as color, let the user pick color from a list of colours (std html color picker input). Let the onus be on the user to pick right color for custom status, we can add standard colours to default statuses.
4. We should have delete on the status, but default status can’t be deleted. Also status names should be unique for a given list, so either we can have combined primary key (auto inc id + color name), or let application layer handle that.
5. Deleting on status should not be possible if any task for the list have status defined. Need to show appropriate error msg asking user to “free” this status first.

### Views

1. Have decided to use following technologies :
    1. React + Typescript
    2. Material UI library (Overall + tree view sidebar + right detail drawer)
    3. For Kanban board → https://github.com/hello-pangea/dnd#readme
2. For state management, we can keep things lean and use regular hooks to store component state. however global state such as selected workspace, react context of global level state, such as isSidebarOpen, list selected, workspace opened, etc (TBD exactly what)
3. Kanban board should be integrated with task status, ordering should be honoured as per position, moving cards should trigger update API for the task to change status.
4. I would prefer dense fit list, with basic icons and editing inside row only. Clicking row should open right sidebar showing task details as mentioned in req doc. The tasks list can be rendered grouped by statuses.
5. For tree view sidebar, as mentioned in req doc, along with necessary CRUD buttons in accordance to above discussion as appropriate.
6. For basic login, lets have simple account indicator and switcher on top right or top left. Small UI, current user is global state, changing triggers proper re-rendering of important views.

### Permissions

1. We can store permissions in a separate table called user_containers_grant, which can be 1:many mapping between users and containers table. Schema is evident from req doc.
2. The user tables can have a field called role that tells if it is admin or member.
3. Also, containers table can store a field that can tell if this container level is public or private.
    1. A locked/unlock icon or a global/secure icon in tree view can be used to indicate and toggle private and public.
    2. A child node can not be made public if any of its parents are private. However for public parents some children could be made private.
    3. admin role users can also see a permissions icon button near every component, and on clicking it, we can show small context menu or modal (TBD) that can show checkbox based list to show which users are allowed access.
    4. removing access changes the entry status in DB, and giving access action upserts the record with allowed status. (I am open to discuss alternate ways of permission handling, this seems most simple and direct).
    5. Also if parent component access is revoked for a user, children access should also be revoked, so the permission update API may do bulk update queries.
4. This info can be loaded when user signs in using JWT info, and we can have API guards to enforce server side protection against unauthorized requests.
    1. admin role users can bypass this rule, allowing them to access all containers
5. We can discuss alternate permission models post development of MVP.

### API and Auth

1. We will use standard REST APIs with JSON req/res powered by Nest.js and Express.
2. Let’s do a JWT based auth, for demo we can use hardcoded password to generate seed data tokens, in seed script and during verification. The JWT tokens expiry can be set to a large value (6 months), so that we don’t need to update it once done for scope of this MVP.
3. We will use offset based pagination for task list endpoints.

### Persistence

1. We will use PostgreSQL. For testing ill deploy local docker container and store endpoints manually, proper dockerisation and compose based workflow is TBD.
2. Seed script will live in project, along with DB initialise script. We can orchestrate both also. It should create JWT tokens also for the users along other things mentioned in requirement doc.

### Tests

1. Jest based test for APIs and task access scenarios.
2. Cypress based Happy path test is TBD.

### Documentation

1. Documentation is TBD post development.
