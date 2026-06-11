import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException
} from "@nestjs/common";
import type { Container, Grant, User } from "@prisma/client";
import { ContainerType, UserRole } from "@prisma/client";
import { ErrorCode } from "../common/errors/error-code";
import { toTreeNodeDto, type ContainerTreeNodeDto } from "../containers/container.dto";
import { PrismaService } from "../prisma/prisma.service";

type AuthzUser = Pick<User, "id" | "name" | "role">;

@Injectable()
export class PermissionsService {
	constructor(private readonly prisma: PrismaService) {}

	async canSeeContainer(user: AuthzUser, containerId: string): Promise<boolean> {
		if (user.role === UserRole.admin) {
			return true;
		}

		const containers = await this.prisma.container.findMany();
		const grants = await this.loadUserGrants(user.id);
		const containerById = new Map(containers.map((container) => [container.id, container]));
		const grantsByResourceId = this.indexGrants(grants);

		return this.canSeeFromMaps(containerId, containerById, grantsByResourceId, false);
	}

	async assertCanSeeContainer(user: AuthzUser, containerId: string): Promise<void> {
		const container = await this.prisma.container.findUnique({
			where: { id: containerId },
			select: { id: true }
		});

		if (!container) {
			throw new NotFoundException({
				code: ErrorCode.NotFound,
				message: "Container not found."
			});
		}

		if (!(await this.canSeeContainer(user, containerId))) {
			throw new ForbiddenException({
				code: ErrorCode.Forbidden,
				message: "You do not have access to this container."
			});
		}
	}

	assertCanMutateContainer(user: AuthzUser): void {
		this.assertAdmin(user, "Only admins can mutate containers.");
	}

	assertCanManageStatuses(user: AuthzUser): void {
		this.assertAdmin(user, "Only admins can manage statuses.");
	}

	assertCanManageGrants(user: AuthzUser): void {
		this.assertAdmin(user, "Only admins can manage grants.");
	}

	async assertCanAccessList(user: AuthzUser, listId: string): Promise<void> {
		const list = await this.prisma.container.findUnique({
			where: { id: listId },
			select: { id: true, type: true }
		});

		if (!list) {
			throw new NotFoundException({
				code: ErrorCode.NotFound,
				message: "List not found."
			});
		}

		if (list.type !== ContainerType.list) {
			throw new BadRequestException({
				code: ErrorCode.ValidationError,
				message: "The requested container is not a list."
			});
		}

		await this.assertCanSeeContainer(user, list.id);
	}

	async assertCanReadTask(user: AuthzUser, taskId: string): Promise<void> {
		const task = await this.prisma.task.findUnique({
			where: { id: taskId },
			select: { primaryListId: true }
		});

		if (!task) {
			throw new NotFoundException({
				code: ErrorCode.NotFound,
				message: "Task not found."
			});
		}

		await this.assertCanAccessList(user, task.primaryListId);
	}

	async assertCanMutateTask(user: AuthzUser, taskId: string): Promise<void> {
		await this.assertCanReadTask(user, taskId);
	}

	async filterVisibleTree(
		user: AuthzUser,
		includeArchived = false
	): Promise<ContainerTreeNodeDto[]> {
		const containers = await this.prisma.container.findMany({
			orderBy: [
				{ parentId: "asc" },
				{ position: "asc" },
				{ name: "asc" }
			]
		});
		const grants = await this.loadUserGrants(user.id);
		const containerById = new Map(containers.map((container) => [container.id, container]));
		const grantsByResourceId = this.indexGrants(grants);

		const visibleContainers = containers.filter((container) => {
			if (user.role === UserRole.admin) {
				return includeArchived || !this.hasArchivedPath(container.id, containerById);
			}

			return this.canSeeFromMaps(
				container.id,
				containerById,
				grantsByResourceId,
				includeArchived
			);
		});

		return this.buildTree(visibleContainers);
	}

	private assertAdmin(user: AuthzUser, message: string): void {
		if (user.role !== UserRole.admin) {
			throw new ForbiddenException({
				code: ErrorCode.Forbidden,
				message
			});
		}
	}

	private async loadUserGrants(userId: string): Promise<Grant[]> {
		return this.prisma.grant.findMany({
			where: { userId }
		});
	}

	private indexGrants(grants: Grant[]): Map<string, Grant> {
		return new Map(grants.map((grant) => [grant.resourceId, grant]));
	}

	private canSeeFromMaps(
		containerId: string,
		containerById: Map<string, Container>,
		grantsByResourceId: Map<string, Grant>,
		includeArchived: boolean
	): boolean {
		const path = this.getPath(containerId, containerById);

		if (path.length === 0) {
			return false;
		}

		if (!includeArchived && path.some((container) => container.isArchived)) {
			return false;
		}

		if (path.some((container) => grantsByResourceId.get(container.id)?.mode === "deny")) {
			return false;
		}

		if (path.every((container) => {
			if (container.visibility === "public") {
				return true;
			}

			return grantsByResourceId.get(container.id)?.mode === "allow";
		})) {
			return true;
		}

		return this.hasAllowedDescendantPath(
			containerId,
			containerById,
			grantsByResourceId,
			includeArchived
		);
	}

	private hasAllowedDescendantPath(
		containerId: string,
		containerById: Map<string, Container>,
		grantsByResourceId: Map<string, Grant>,
		includeArchived: boolean
	): boolean {
		for (const grant of grantsByResourceId.values()) {
			if (grant.mode !== "allow") {
				continue;
			}

			const grantedPath = this.getPath(grant.resourceId, containerById);

			if (!grantedPath.some((container) => container.id === containerId)) {
				continue;
			}

			if (!includeArchived && grantedPath.some((container) => container.isArchived)) {
				continue;
			}

			if (grantedPath.some((container) => grantsByResourceId.get(container.id)?.mode === "deny")) {
				continue;
			}

			return true;
		}

		return false;
	}

	private hasArchivedPath(containerId: string, containerById: Map<string, Container>): boolean {
		return this.getPath(containerId, containerById).some((container) => container.isArchived);
	}

	private getPath(containerId: string, containerById: Map<string, Container>): Container[] {
		const path: Container[] = [];
		const visited = new Set<string>();
		let current = containerById.get(containerId);

		while (current) {
			if (visited.has(current.id)) {
				return [];
			}

			visited.add(current.id);
			path.unshift(current);
			current = current.parentId ? containerById.get(current.parentId) : undefined;
		}

		return path;
	}

	private buildTree(containers: Container[]): ContainerTreeNodeDto[] {
		const childrenByParentId = new Map<string | null, Container[]>();

		for (const container of containers) {
			const siblings = childrenByParentId.get(container.parentId) ?? [];
			siblings.push(container);
			childrenByParentId.set(container.parentId, siblings);
		}

		const buildChildren = (parentId: string | null): ContainerTreeNodeDto[] => {
			const children = childrenByParentId.get(parentId) ?? [];
			children.sort((first, second) => first.position - second.position);

			return children.map((container) => toTreeNodeDto(container, buildChildren(container.id)));
		};

		return buildChildren(null);
	}
}
