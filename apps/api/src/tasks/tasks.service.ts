import {
	BadRequestException,
	Injectable,
	NotFoundException
} from "@nestjs/common";
import {
	Prisma,
	StatusCategory,
	TaskPriority,
	type Status,
	type Task
} from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ErrorCode } from "../common/errors/error-code";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateTaskDto } from "./dto/create-task.dto";
import { TaskSort, type ListTasksQuery } from "./dto/list-tasks.query";
import type { MoveTaskDto } from "./dto/move-task.dto";
import type { ReorderTasksDto } from "./dto/reorder-tasks.dto";
import type { UpdateTaskDto } from "./dto/update-task.dto";
import { toTaskDto, type PaginatedTasksResponse, type TaskDto } from "./task.dto";

@Injectable()
export class TasksService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly permissions: PermissionsService
	) {}

	async listTasks(
		user: AuthenticatedUser,
		query: ListTasksQuery
	): Promise<PaginatedTasksResponse> {
		await this.permissions.assertCanAccessList(user, query.listId);
		const searchQuery = this.normalizedSearchQuery(query.q);

		if (searchQuery) {
			return this.searchTasks(query, searchQuery);
		}

		const [total, tasks] = await Promise.all([
			this.prisma.task.count({
				where: { primaryListId: query.listId }
			}),
			this.prisma.task.findMany({
				where: { primaryListId: query.listId },
				include: { assignees: true },
				orderBy: this.orderByForQuery(query),
				skip: query.offset,
				take: query.limit
			})
		]);

		return {
			data: tasks.map(toTaskDto),
			pagination: {
				limit: query.limit,
				offset: query.offset,
				total
			}
		};
	}

	private async searchTasks(
		query: ListTasksQuery,
		searchQuery: string
	): Promise<PaginatedTasksResponse> {
		const [countResult, rows] = await Promise.all([
			this.prisma.$queryRaw<Array<{ count: bigint }>>`
				SELECT COUNT(*)::bigint AS count
				FROM "tasks"
				WHERE "primaryListId" = CAST(${query.listId} AS uuid)
					AND ${this.rawSearchPredicate(searchQuery)}
			`,
			this.prisma.$queryRaw<Array<{ id: string }>>`
				SELECT task."id"
				FROM "tasks" task
				INNER JOIN "statuses" status ON status."id" = task."statusId"
				WHERE task."primaryListId" = CAST(${query.listId} AS uuid)
					AND ${this.rawSearchPredicate(searchQuery, "task")}
				ORDER BY ${this.rawOrderByForQuery(query)}
				LIMIT ${query.limit}
				OFFSET ${query.offset}
			`
		]);
		const ids = rows.map((row) => row.id);

		if (ids.length === 0) {
			return {
				data: [],
				pagination: {
					limit: query.limit,
					offset: query.offset,
					total: Number(countResult[0]?.count ?? 0)
				}
			};
		}

		const tasks = await this.prisma.task.findMany({
			where: { id: { in: ids } },
			include: { assignees: true }
		});
		const taskById = new Map(tasks.map((task) => [task.id, task]));

		return {
			data: ids.flatMap((id) => {
				const task = taskById.get(id);
				return task ? [toTaskDto(task)] : [];
			}),
			pagination: {
				limit: query.limit,
				offset: query.offset,
				total: Number(countResult[0]?.count ?? 0)
			}
		};
	}

	async getTask(user: AuthenticatedUser, id: string): Promise<TaskDto> {
		await this.permissions.assertCanReadTask(user, id);

		const task = await this.findTaskWithAssigneesOrThrow(id);
		return toTaskDto(task);
	}

	async createTask(user: AuthenticatedUser, dto: CreateTaskDto): Promise<TaskDto> {
		await this.permissions.assertCanAccessList(user, dto.primaryListId);
		const status = dto.statusId
			? await this.assertStatusBelongsToList(dto.statusId, dto.primaryListId)
			: await this.findTodoStatus(dto.primaryListId);
		await this.assertAssigneesExist(dto.assigneeIds ?? []);

		const position = await this.nextTaskPosition(dto.primaryListId, status.id);
		const task = await this.prisma.$transaction(async (tx) => {
			const created = await tx.task.create({
				data: {
					title: dto.title,
					description: dto.description,
					primaryListId: dto.primaryListId,
					statusId: status.id,
					priority: dto.priority ?? TaskPriority.none,
					dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
					position
				}
			});

			await this.replaceAssignees(tx, created.id, dto.assigneeIds ?? []);

			return tx.task.findUniqueOrThrow({
				where: { id: created.id },
				include: { assignees: true }
			});
		});

		return toTaskDto(task);
	}

	async updateTask(
		user: AuthenticatedUser,
		id: string,
		dto: UpdateTaskDto
	): Promise<TaskDto> {
		const existing = await this.findTaskOrThrow(id);
		await this.permissions.assertCanAccessList(user, existing.primaryListId);

		if (dto.statusId) {
			await this.assertStatusBelongsToList(dto.statusId, existing.primaryListId);
		}

		if (dto.assigneeIds) {
			await this.assertAssigneesExist(dto.assigneeIds);
		}

		const task = await this.prisma.$transaction(async (tx) => {
			if (dto.assigneeIds) {
				await this.replaceAssignees(tx, id, dto.assigneeIds);
			}

			const statusChanged = Boolean(dto.statusId && dto.statusId !== existing.statusId);
			const position = statusChanged
				? await this.nextTaskPosition(existing.primaryListId, dto.statusId!, tx)
				: undefined;

			const updated = await tx.task.update({
				where: { id },
				data: {
					title: dto.title,
					description: dto.description,
					statusId: dto.statusId,
					priority: dto.priority,
					dueDate: dto.dueDate === undefined
						? undefined
						: dto.dueDate === null
							? null
							: new Date(dto.dueDate),
					position
				},
				include: { assignees: true }
			});

			if (statusChanged) {
				await this.normalizeColumnPositions(tx, existing.primaryListId, existing.statusId);
			}

			return updated;
		});

		return toTaskDto(task);
	}

	async moveTask(
		user: AuthenticatedUser,
		id: string,
		dto: MoveTaskDto
	): Promise<TaskDto> {
		const existing = await this.findTaskOrThrow(id);
		await this.permissions.assertCanAccessList(user, existing.primaryListId);

		const targetListId = dto.targetListId ?? existing.primaryListId;
		await this.permissions.assertCanAccessList(user, targetListId);
		const targetStatus = await this.resolveTargetStatus(existing, targetListId, dto.targetStatusId);

		const task = await this.prisma.$transaction(async (tx) => {
			await tx.task.update({
				where: { id },
				data: {
					primaryListId: targetListId,
					statusId: targetStatus.id,
					position: -1
				}
			});

			const targetTasks = await tx.task.findMany({
				where: {
					primaryListId: targetListId,
					statusId: targetStatus.id,
					id: { not: id }
				},
				orderBy: { position: "asc" }
			});
			const orderedIds = targetTasks.map((task) => task.id);
			const targetPosition = this.clampPosition(
				dto.targetPosition ?? orderedIds.length,
				orderedIds.length
			);
			orderedIds.splice(targetPosition, 0, id);

			await this.rewriteTaskPositions(tx, targetListId, targetStatus.id, orderedIds);

			if (
				existing.primaryListId !== targetListId ||
				existing.statusId !== targetStatus.id
			) {
				await this.normalizeColumnPositions(tx, existing.primaryListId, existing.statusId);
			}

			return tx.task.findUniqueOrThrow({
				where: { id },
				include: { assignees: true }
			});
		});

		return toTaskDto(task);
	}

	async reorderTasks(user: AuthenticatedUser, dto: ReorderTasksDto): Promise<void> {
		for (const column of dto.columns) {
			await this.permissions.assertCanAccessList(user, column.listId);
			await this.assertStatusBelongsToList(column.statusId, column.listId);
		}

		await this.prisma.$transaction(async (tx) => {
			for (const column of dto.columns) {
				await this.assertColumnContainsExactly(column.listId, column.statusId, column.orderedTaskIds, tx);
				await this.rewriteTaskPositions(tx, column.listId, column.statusId, column.orderedTaskIds);
			}
		});
	}

	async deleteTask(user: AuthenticatedUser, id: string): Promise<void> {
		const existing = await this.findTaskOrThrow(id);
		await this.permissions.assertCanAccessList(user, existing.primaryListId);

		await this.prisma.$transaction(async (tx) => {
			await tx.task.delete({ where: { id } });
			await this.normalizeColumnPositions(tx, existing.primaryListId, existing.statusId);
		});
	}

	private orderByForQuery(query: ListTasksQuery): Prisma.TaskOrderByWithRelationInput[] {
		if (query.sort === TaskSort.dueDate) {
			return [
				{ dueDate: { sort: query.direction, nulls: "last" } },
				{ position: "asc" }
			];
		}

		if (query.sort === TaskSort.priority) {
			return [
				{ priority: query.direction },
				{ status: { position: "asc" } },
				{ position: "asc" }
			];
		}

		return [
			{ status: { position: "asc" } },
			{ position: "asc" }
		];
	}

	private rawOrderByForQuery(query: ListTasksQuery): Prisma.Sql {
		const direction = query.direction === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;

		if (query.sort === TaskSort.dueDate) {
			return Prisma.sql`task."dueDate" ${direction} NULLS LAST, task."position" ASC, task."id" ASC`;
		}

		if (query.sort === TaskSort.priority) {
			return Prisma.sql`task."priority" ${direction}, status."position" ASC, task."position" ASC, task."id" ASC`;
		}

		return Prisma.sql`status."position" ASC, task."position" ASC, task."id" ASC`;
	}

	private rawSearchPredicate(searchQuery: string, tableAlias?: string): Prisma.Sql {
		const titleColumn = tableAlias
			? Prisma.raw(`${tableAlias}."title"`)
			: Prisma.sql`"title"`;
		const descriptionColumn = tableAlias
			? Prisma.raw(`${tableAlias}."description"`)
			: Prisma.sql`"description"`;
		const likeQuery = `%${searchQuery}%`;

		return Prisma.sql`(
			to_tsvector('english', coalesce(${titleColumn}, '') || ' ' || coalesce(${descriptionColumn}, ''))
				@@ plainto_tsquery('english', ${searchQuery})
			OR ${titleColumn} ILIKE ${likeQuery}
			OR ${descriptionColumn} ILIKE ${likeQuery}
		)`;
	}

	private normalizedSearchQuery(query?: string): string | null {
		const trimmed = query?.trim();
		return trimmed ? trimmed : null;
	}

	private async resolveTargetStatus(
		existing: Pick<Task, "primaryListId" | "statusId">,
		targetListId: string,
		targetStatusId?: string
	): Promise<Status> {
		if (targetStatusId) {
			return this.assertStatusBelongsToList(targetStatusId, targetListId);
		}

		const currentStatus = await this.findStatusOrThrow(existing.statusId);
		const matchingStatus = await this.prisma.status.findUnique({
			where: {
				listId_key: {
					listId: targetListId,
					key: currentStatus.key
				}
			}
		});

		return matchingStatus ?? this.findTodoStatus(targetListId);
	}

	private async assertColumnContainsExactly(
		listId: string,
		statusId: string,
		orderedTaskIds: string[],
		tx: Prisma.TransactionClient
	): Promise<void> {
		const tasks = await tx.task.findMany({
			where: {
				primaryListId: listId,
				statusId
			},
			select: { id: true }
		});
		const existingIds = tasks.map((task) => task.id);
		const requestedIds = new Set(orderedTaskIds);

		if (
			existingIds.length !== orderedTaskIds.length ||
			existingIds.some((taskId) => !requestedIds.has(taskId))
		) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: "orderedTaskIds must contain every task in the requested list/status column."
			});
		}
	}

	private async normalizeColumnPositions(
		tx: Prisma.TransactionClient,
		listId: string,
		statusId: string
	): Promise<void> {
		const tasks = await tx.task.findMany({
			where: {
				primaryListId: listId,
				statusId
			},
			orderBy: { position: "asc" }
		});

		await this.rewriteTaskPositions(
			tx,
			listId,
			statusId,
			tasks.map((task) => task.id)
		);
	}

	private async rewriteTaskPositions(
		tx: Prisma.TransactionClient,
		listId: string,
		statusId: string,
		orderedTaskIds: string[]
	): Promise<void> {
		await Promise.all(
			orderedTaskIds.map((id, index) =>
				tx.task.update({
					where: { id },
					data: {
						primaryListId: listId,
						statusId,
						position: index
					}
				})
			)
		);
	}

	private async replaceAssignees(
		tx: Prisma.TransactionClient,
		taskId: string,
		assigneeIds: string[]
	): Promise<void> {
		await tx.taskAssignee.deleteMany({ where: { taskId } });

		if (assigneeIds.length === 0) {
			return;
		}

		await tx.taskAssignee.createMany({
			data: [...new Set(assigneeIds)].map((userId) => ({
				taskId,
				userId
			}))
		});
	}

	private async assertAssigneesExist(userIds: string[]): Promise<void> {
		const uniqueUserIds = [...new Set(userIds)];

		if (uniqueUserIds.length === 0) {
			return;
		}

		const count = await this.prisma.user.count({
			where: {
				id: { in: uniqueUserIds }
			}
		});

		if (count !== uniqueUserIds.length) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: "One or more assignee IDs do not exist."
			});
		}
	}

	private async nextTaskPosition(
		listId: string,
		statusId: string,
		tx: Prisma.TransactionClient | PrismaService = this.prisma
	): Promise<number> {
		const aggregate = await tx.task.aggregate({
			where: {
				primaryListId: listId,
				statusId
			},
			_max: { position: true }
		});

		return (aggregate._max.position ?? -1) + 1;
	}

	private async assertStatusBelongsToList(statusId: string, listId: string): Promise<Status> {
		const status = await this.findStatusOrThrow(statusId);

		if (status.listId !== listId) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: "Task status must belong to the task's primary list."
			});
		}

		return status;
	}

	private async findTodoStatus(listId: string): Promise<Status> {
		const status = await this.prisma.status.findUnique({
			where: {
				listId_key: {
					listId,
					key: StatusCategory.todo
				}
			}
		});

		if (!status) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: "The target list does not have a todo status."
			});
		}

		return status;
	}

	private async findStatusOrThrow(id: string): Promise<Status> {
		const status = await this.prisma.status.findUnique({ where: { id } });

		if (!status) {
			throw new NotFoundException({
				code: ErrorCode.NotFound,
				message: "Status not found."
			});
		}

		return status;
	}

	private async findTaskOrThrow(id: string): Promise<Task> {
		const task = await this.prisma.task.findUnique({ where: { id } });

		if (!task) {
			throw new NotFoundException({
				code: ErrorCode.NotFound,
				message: "Task not found."
			});
		}

		return task;
	}

	private async findTaskWithAssigneesOrThrow(id: string) {
		const task = await this.prisma.task.findUnique({
			where: { id },
			include: { assignees: true }
		});

		if (!task) {
			throw new NotFoundException({
				code: ErrorCode.NotFound,
				message: "Task not found."
			});
		}

		return task;
	}

	private clampPosition(position: number, maxInclusive: number): number {
		return Math.max(0, Math.min(position, maxInclusive));
	}
}
