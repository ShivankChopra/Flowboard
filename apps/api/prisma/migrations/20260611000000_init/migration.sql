-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "ContainerType" AS ENUM ('workspace', 'space', 'folder', 'list');

-- CreateEnum
CREATE TYPE "ContainerVisibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "GrantMode" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('urgent', 'high', 'normal', 'low', 'none');

-- CreateEnum
CREATE TYPE "StatusCategory" AS ENUM ('todo', 'in_progress', 'done');

-- CreateTable
CREATE TABLE "users" (
	"id" TEXT NOT NULL,
	"name" TEXT NOT NULL,
	"role" "UserRole" NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "containers" (
	"id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"type" "ContainerType" NOT NULL,
	"parentId" UUID,
	"position" INTEGER NOT NULL,
	"visibility" "ContainerVisibility" NOT NULL DEFAULT 'public',
	"isArchived" BOOLEAN NOT NULL DEFAULT false,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grants" (
	"id" UUID NOT NULL,
	"resourceId" UUID NOT NULL,
	"userId" TEXT NOT NULL,
	"mode" "GrantMode" NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statuses" (
	"id" UUID NOT NULL,
	"listId" UUID NOT NULL,
	"key" TEXT NOT NULL,
	"name" TEXT NOT NULL,
	"category" "StatusCategory" NOT NULL,
	"color" TEXT NOT NULL,
	"position" INTEGER NOT NULL,
	"isDefault" BOOLEAN NOT NULL DEFAULT false,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
	"id" UUID NOT NULL,
	"title" VARCHAR(500) NOT NULL,
	"description" TEXT,
	"priority" "TaskPriority" NOT NULL DEFAULT 'none',
	"dueDate" TIMESTAMP(3),
	"position" INTEGER NOT NULL,
	"primaryListId" UUID NOT NULL,
	"statusId" UUID NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
	"taskId" UUID NOT NULL,
	"userId" TEXT NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("taskId", "userId")
);

-- CreateIndex
CREATE INDEX "containers_parentId_position_idx" ON "containers"("parentId", "position");

-- CreateIndex
CREATE INDEX "containers_type_idx" ON "containers"("type");

-- CreateIndex
CREATE INDEX "containers_visibility_idx" ON "containers"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "grants_resourceId_userId_key" ON "grants"("resourceId", "userId");

-- CreateIndex
CREATE INDEX "grants_userId_mode_idx" ON "grants"("userId", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "statuses_listId_key_key" ON "statuses"("listId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "statuses_listId_position_key" ON "statuses"("listId", "position");

-- CreateIndex
CREATE INDEX "statuses_listId_idx" ON "statuses"("listId");

-- CreateIndex
CREATE INDEX "tasks_primaryListId_statusId_position_idx" ON "tasks"("primaryListId", "statusId", "position");

-- CreateIndex
CREATE INDEX "tasks_statusId_idx" ON "tasks"("statusId");

-- CreateIndex
CREATE INDEX "tasks_dueDate_idx" ON "tasks"("dueDate");

-- CreateIndex
CREATE INDEX "task_assignees_userId_idx" ON "task_assignees"("userId");

-- AddForeignKey
ALTER TABLE "containers" ADD CONSTRAINT "containers_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grants" ADD CONSTRAINT "grants_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grants" ADD CONSTRAINT "grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_listId_fkey" FOREIGN KEY ("listId") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_primaryListId_fkey" FOREIGN KEY ("primaryListId") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
