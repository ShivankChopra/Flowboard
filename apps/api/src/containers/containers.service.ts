import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException
} from "@nestjs/common";
import {
	ContainerType,
	ContainerVisibility,
	Prisma,
	StatusCategory
} from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ErrorCode } from "../common/errors/error-code";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import {
	toContainerDto,
	toGrantDto,
	type ContainerDto,
	type ContainerTreeNodeDto,
	type GrantDto
} from "./container.dto";
import type { ArchiveContainerDto } from "./dto/archive-container.dto";
import type { CreateContainerDto } from "./dto/create-container.dto";
import type { ReorderContainerDto } from "./dto/reorder-container.dto";
import type { UpdateContainerDto } from "./dto/update-container.dto";
import type { UpsertGrantDto } from "./dto/upsert-grant.dto";

const allowedParentType: Partial<Record<ContainerType, ContainerType>> = {
	[ContainerType.space]: ContainerType.workspace,
	[ContainerType.folder]: ContainerType.space,
	[ContainerType.list]: ContainerType.folder
};

const defaultStatuses = [
	{
		key: "todo",
		name: "Todo",
		category: StatusCategory.todo,
		color: "#64748b",
		position: 0
	},
	{
		key: "in_progress",
		name: "In Progress",
		category: StatusCategory.in_progress,
		color: "#2563eb",
		position: 1
	},
	{
		key: "done",
		name: "Done",
		category: StatusCategory.done,
		color: "#16a34a",
		position: 2
	}
] as const;

@Injectable()
export class ContainersService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly permissions: PermissionsService
	) {}

	getTree(
		user: AuthenticatedUser,
		includeArchived: boolean
	): Promise<ContainerTreeNodeDto[]> {
		return this.permissions.filterVisibleTree(user, includeArchived);
	}

	async getContainer(user: AuthenticatedUser, id: string): Promise<ContainerDto> {
		await this.permissions.assertCanSeeContainer(user, id);

		const container = await this.findContainerOrThrow(id);
		return toContainerDto(container);
	}

	async createContainer(
		user: AuthenticatedUser,
		dto: CreateContainerDto
	): Promise<ContainerDto> {
		this.permissions.assertCanMutateContainer(user);
		await this.validateCreateRequest(dto);

		const visibility = dto.visibility ?? ContainerVisibility.public;
		const position = await this.nextSiblingPosition(dto.parentId);

		const container = await this.prisma.$transaction(async (tx) => {
			const created = await tx.container.create({
				data: {
					name: dto.name,
					type: dto.type,
					parentId: dto.parentId,
					position,
					visibility
				}
			});

			if (created.type === ContainerType.list) {
				await tx.status.createMany({
					data: defaultStatuses.map((status) => ({
						...status,
						category: status.category,
						isDefault: true,
						listId: created.id
					}))
				});
			}

			return created;
		});

		return toContainerDto(container);
	}

	async updateContainer(
		user: AuthenticatedUser,
		id: string,
		dto: UpdateContainerDto
	): Promise<ContainerDto> {
		this.permissions.assertCanMutateContainer(user);
		const existing = await this.findContainerOrThrow(id);

		if (dto.visibility === ContainerVisibility.public) {
			await this.assertPublicVisibilityAllowed(existing.parentId);
		}

		const container = await this.prisma.$transaction(async (tx) => {
			if (dto.visibility === ContainerVisibility.private) {
				const subtreeIds = await this.collectSubtreeIds(id, tx);
				await tx.container.updateMany({
					where: { id: { in: subtreeIds } },
					data: { visibility: ContainerVisibility.private }
				});
			}

			return tx.container.update({
				where: { id },
				data: {
					name: dto.name,
					visibility: dto.visibility
				}
			});
		});

		return toContainerDto(container);
	}

	async reorderContainer(
		user: AuthenticatedUser,
		id: string,
		dto: ReorderContainerDto
	): Promise<ContainerDto[]> {
		this.permissions.assertCanMutateContainer(user);

		if (!dto.orderedIds.includes(id)) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: "The reordered container id must be included in orderedIds."
			});
		}

		const movingContainer = await this.findContainerOrThrow(id);
		const targetParent = await this.findContainerOrThrow(dto.parentId);
		const expectedParentType = allowedParentType[movingContainer.type];

		if (!expectedParentType) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: "Workspace containers cannot be moved."
			});
		}

		if (targetParent.type !== expectedParentType) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: `${movingContainer.type} containers must be moved under ${expectedParentType} containers.`
			});
		}

		if (targetParent.isArchived) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: "Cannot move a container under an archived parent."
			});
		}

		const targetParentPath = await this.loadAncestorPath(dto.parentId);

		if (targetParentPath.some((container) => container.id === id)) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: "Cannot move a container into its own subtree."
			});
		}

		const isParentChanged = movingContainer.parentId !== dto.parentId;
		const targetSiblings = await this.prisma.container.findMany({
			where: { parentId: dto.parentId },
			orderBy: { position: "asc" }
		});
		const expectedTargetIds = isParentChanged
			? [...targetSiblings.map((sibling) => sibling.id), id]
			: targetSiblings.map((sibling) => sibling.id);

		if (!this.hasSameIds(dto.orderedIds, expectedTargetIds)) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: "orderedIds must contain every child under the target parent, including the moved container."
			});
		}

		const shouldMakeSubtreePrivate =
			isParentChanged &&
			targetParentPath.some(
				(container) => container.visibility === ContainerVisibility.private
			);

		const reordered = await this.prisma.$transaction(async (tx) => {
			if (isParentChanged) {
				await tx.container.update({
					where: { id },
					data: { parentId: dto.parentId }
				});

				const sourceSiblings = await tx.container.findMany({
					where: { parentId: movingContainer.parentId },
					orderBy: { position: "asc" }
				});

				await this.rewriteSiblingPositions(
					sourceSiblings.map((sibling) => sibling.id),
					tx
				);
			}

			await Promise.all(
				dto.orderedIds.map((containerId, position) =>
					tx.container.update({
						where: { id: containerId },
						data: { position }
					})
				)
			);

			if (shouldMakeSubtreePrivate) {
				const subtreeIds = await this.collectSubtreeIds(id, tx);
				await tx.container.updateMany({
					where: { id: { in: subtreeIds } },
					data: { visibility: ContainerVisibility.private }
				});
			}

			return tx.container.findMany({
				where: { parentId: dto.parentId },
				orderBy: { position: "asc" }
			});
		});

		return reordered.map(toContainerDto);
	}

	async archiveContainer(
		user: AuthenticatedUser,
		id: string,
		dto: ArchiveContainerDto
	): Promise<ContainerDto> {
		this.permissions.assertCanMutateContainer(user);
		await this.findContainerOrThrow(id);

		const container = await this.prisma.$transaction(async (tx) => {
			const subtreeIds = await this.collectSubtreeIds(id, tx);
			await tx.container.updateMany({
				where: { id: { in: subtreeIds } },
				data: { isArchived: dto.isArchived }
			});

			return tx.container.findUniqueOrThrow({ where: { id } });
		});

		return toContainerDto(container);
	}

	async deleteContainer(user: AuthenticatedUser, id: string): Promise<void> {
		this.permissions.assertCanMutateContainer(user);
		const container = await this.findContainerOrThrow(id);

		if (container.type === ContainerType.workspace) {
			throw new ConflictException({
				code: ErrorCode.Conflict,
				message: "Workspace deletion is not part of the MVP API."
			});
		}

		const [childCount, taskCount] = await Promise.all([
			this.prisma.container.count({ where: { parentId: id } }),
			this.prisma.task.count({ where: { primaryListId: id } })
		]);

		if (childCount > 0 || taskCount > 0) {
			throw new ConflictException({
				code: ErrorCode.Conflict,
				message: "Only empty containers can be hard-deleted. Archive this container instead."
			});
		}

		await this.prisma.container.delete({ where: { id } });
	}

	async listGrants(user: AuthenticatedUser, containerId: string): Promise<GrantDto[]> {
		this.permissions.assertCanManageGrants(user);
		await this.findContainerOrThrow(containerId);

		const grants = await this.prisma.grant.findMany({
			where: { resourceId: containerId },
			orderBy: { userId: "asc" }
		});

		return grants.map(toGrantDto);
	}

	async upsertGrant(
		user: AuthenticatedUser,
		containerId: string,
		targetUserId: string,
		dto: UpsertGrantDto
	): Promise<GrantDto> {
		this.permissions.assertCanManageGrants(user);
		await this.findContainerOrThrow(containerId);
		await this.findUserOrThrow(targetUserId);

		const grant = await this.prisma.grant.upsert({
			where: {
				resourceId_userId: {
					resourceId: containerId,
					userId: targetUserId
				}
			},
			create: {
				resourceId: containerId,
				userId: targetUserId,
				mode: dto.mode
			},
			update: {
				mode: dto.mode
			}
		});

		return toGrantDto(grant);
	}

	async deleteGrant(
		user: AuthenticatedUser,
		containerId: string,
		targetUserId: string
	): Promise<void> {
		this.permissions.assertCanManageGrants(user);
		await this.findContainerOrThrow(containerId);

		await this.prisma.grant.deleteMany({
			where: {
				resourceId: containerId,
				userId: targetUserId
			}
		});
	}

	private async validateCreateRequest(dto: CreateContainerDto): Promise<void> {
		if (dto.type === ContainerType.workspace) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: "Creating workspaces through the container API is not supported."
			});
		}

		const parent = await this.findContainerOrThrow(dto.parentId);
		const expectedParentType = allowedParentType[dto.type];

		if (parent.type !== expectedParentType) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: `${dto.type} containers must be created under ${expectedParentType} containers.`
			});
		}

		if (parent.isArchived) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: "Cannot create a container under an archived parent."
			});
		}

		if ((dto.visibility ?? ContainerVisibility.public) === ContainerVisibility.public) {
			await this.assertPublicVisibilityAllowed(parent.id);
		}
	}

	private async assertPublicVisibilityAllowed(parentId: string | null): Promise<void> {
		if (!parentId) {
			return;
		}

		const ancestors = await this.loadAncestorPath(parentId);
		const privateAncestor = [...ancestors].reverse().find(
			(container) => container.visibility === ContainerVisibility.private
		);

		if (privateAncestor) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: `Cannot make this container public because ${privateAncestor.type} "${privateAncestor.name}" is private.`
			});
		}
	}

	private async loadAncestorPath(containerId: string): Promise<Array<{
		id: string;
		name: string;
		parentId: string | null;
		type: ContainerType;
		visibility: ContainerVisibility;
	}>> {
		const containers = await this.prisma.container.findMany({
			select: {
				id: true,
				name: true,
				parentId: true,
				type: true,
				visibility: true
			}
		});
		const containerById = new Map(containers.map((container) => [container.id, container]));
		const path: Array<{
			id: string;
			name: string;
			parentId: string | null;
			type: ContainerType;
			visibility: ContainerVisibility;
		}> = [];
		const visited = new Set<string>();
		let current = containerById.get(containerId);

		while (current) {
			if (visited.has(current.id)) {
				throw new BadRequestException({
					code: ErrorCode.ValidationError,
					message: "Container hierarchy contains a cycle."
				});
			}

			visited.add(current.id);
			path.unshift(current);
			current = current.parentId ? containerById.get(current.parentId) : undefined;
		}

		return path;
	}

	private async nextSiblingPosition(parentId: string): Promise<number> {
		const aggregate = await this.prisma.container.aggregate({
			where: { parentId },
			_max: { position: true }
		});

		return (aggregate._max.position ?? -1) + 1;
	}

	private async collectSubtreeIds(
		rootId: string,
		tx: Prisma.TransactionClient
	): Promise<string[]> {
		const containers = await tx.container.findMany({
			select: {
				id: true,
				parentId: true
			}
		});
		const childIdsByParentId = new Map<string, string[]>();

		for (const container of containers) {
			if (!container.parentId) {
				continue;
			}

			const childIds = childIdsByParentId.get(container.parentId) ?? [];
			childIds.push(container.id);
			childIdsByParentId.set(container.parentId, childIds);
		}

		const ids = [rootId];
		const pending = [rootId];

		while (pending.length > 0) {
			const currentId = pending.pop()!;
			const childIds = childIdsByParentId.get(currentId) ?? [];
			ids.push(...childIds);
			pending.push(...childIds);
		}

		return ids;
	}

	private hasSameIds(firstIds: string[], secondIds: string[]): boolean {
		if (firstIds.length !== secondIds.length) {
			return false;
		}

		const firstSet = new Set(firstIds);
		const secondSet = new Set(secondIds);

		if (firstSet.size !== firstIds.length || secondSet.size !== secondIds.length) {
			return false;
		}

		return secondIds.every((id) => firstSet.has(id));
	}

	private async rewriteSiblingPositions(
		orderedIds: string[],
		tx: Prisma.TransactionClient
	): Promise<void> {
		await Promise.all(
			orderedIds.map((containerId, position) =>
				tx.container.update({
					where: { id: containerId },
					data: { position }
				})
			)
		);
	}

	private async findContainerOrThrow(id: string) {
		const container = await this.prisma.container.findUnique({ where: { id } });

		if (!container) {
			throw new NotFoundException({
				code: ErrorCode.NotFound,
				message: "Container not found."
			});
		}

		return container;
	}

	private async findUserOrThrow(id: string) {
		const user = await this.prisma.user.findUnique({
			where: { id },
			select: { id: true }
		});

		if (!user) {
			throw new NotFoundException({
				code: ErrorCode.NotFound,
				message: "User not found."
			});
		}
	}
}
