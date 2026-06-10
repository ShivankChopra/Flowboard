import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException
} from "@nestjs/common";
import { ContainerType, Prisma, type Status } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ErrorCode } from "../common/errors/error-code";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateStatusDto } from "./dto/create-status.dto";
import type { UpdateStatusDto } from "./dto/update-status.dto";
import { toStatusDto, type StatusDto } from "./status.dto";

@Injectable()
export class StatusesService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly permissions: PermissionsService
	) {}

	async listStatuses(user: AuthenticatedUser, listId: string): Promise<StatusDto[]> {
		await this.permissions.assertCanAccessList(user, listId);

		const statuses = await this.prisma.status.findMany({
			where: { listId },
			orderBy: { position: "asc" }
		});

		return statuses.map(toStatusDto);
	}

	async createStatus(user: AuthenticatedUser, dto: CreateStatusDto): Promise<StatusDto> {
		this.permissions.assertCanManageStatuses(user);
		await this.assertListContainer(dto.listId);

		const existingWithKey = await this.prisma.status.findUnique({
			where: {
				listId_key: {
					listId: dto.listId,
					key: dto.key
				}
			}
		});

		if (existingWithKey) {
			throw new ConflictException({
				code: ErrorCode.Conflict,
				message: "A status with this key already exists on the list."
			});
		}

		const status = await this.prisma.$transaction(async (tx) => {
			const currentStatuses = await tx.status.findMany({
				where: { listId: dto.listId },
				orderBy: { position: "asc" }
			});
			const targetPosition = this.clampPosition(
				dto.position ?? currentStatuses.length,
				currentStatuses.length
			);
			const created = await tx.status.create({
				data: {
					listId: dto.listId,
					key: dto.key,
					name: dto.name,
					category: dto.category,
					color: dto.color,
					position: currentStatuses.length + 1000,
					isDefault: false
				}
			});
			const orderedIds = currentStatuses.map((status) => status.id);
			orderedIds.splice(targetPosition, 0, created.id);

			await this.rewriteStatusPositions(tx, orderedIds);

			return tx.status.findUniqueOrThrow({ where: { id: created.id } });
		});

		return toStatusDto(status);
	}

	async updateStatus(
		user: AuthenticatedUser,
		id: string,
		dto: UpdateStatusDto
	): Promise<StatusDto> {
		this.permissions.assertCanManageStatuses(user);
		const existing = await this.findStatusOrThrow(id);
		await this.assertListContainer(existing.listId);

		const status = await this.prisma.$transaction(async (tx) => {
			await tx.status.update({
				where: { id },
				data: {
					name: dto.name,
					category: dto.category,
					color: dto.color
				}
			});

			if (dto.position !== undefined && dto.position !== existing.position) {
				const statuses = await tx.status.findMany({
					where: { listId: existing.listId },
					orderBy: { position: "asc" }
				});
				const orderedIds = statuses
					.filter((status) => status.id !== id)
					.map((status) => status.id);
				const targetPosition = this.clampPosition(dto.position, orderedIds.length);
				orderedIds.splice(targetPosition, 0, id);

				await this.rewriteStatusPositions(tx, orderedIds);
			}

			return tx.status.findUniqueOrThrow({ where: { id } });
		});

		return toStatusDto(status);
	}

	async deleteStatus(user: AuthenticatedUser, id: string): Promise<void> {
		this.permissions.assertCanManageStatuses(user);
		const status = await this.findStatusOrThrow(id);

		if (status.isDefault) {
			throw new ConflictException({
				code: ErrorCode.Conflict,
				message: "Default statuses cannot be deleted."
			});
		}

		const taskCount = await this.prisma.task.count({
			where: { statusId: id }
		});

		if (taskCount > 0) {
			throw new ConflictException({
				code: ErrorCode.Conflict,
				message: "This status is in use and must be emptied before deletion."
			});
		}

		await this.prisma.$transaction(async (tx) => {
			await tx.status.delete({ where: { id } });

			const remainingStatuses = await tx.status.findMany({
				where: { listId: status.listId },
				orderBy: { position: "asc" }
			});

			await this.rewriteStatusPositions(
				tx,
				remainingStatuses.map((remainingStatus) => remainingStatus.id)
			);
		});
	}

	private async assertListContainer(listId: string): Promise<void> {
		const list = await this.prisma.container.findUnique({
			where: { id: listId },
			select: { type: true }
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
				message: "Statuses can only be configured on list containers."
			});
		}
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

	private clampPosition(position: number, maxInclusive: number): number {
		return Math.max(0, Math.min(position, maxInclusive));
	}

	private async rewriteStatusPositions(
		tx: Prisma.TransactionClient,
		orderedIds: string[]
	): Promise<void> {
		await Promise.all(
			orderedIds.map((id, index) =>
				tx.status.update({
					where: { id },
					data: { position: index + 1000 }
				})
			)
		);
		await Promise.all(
			orderedIds.map((id, index) =>
				tx.status.update({
					where: { id },
					data: { position: index }
				})
			)
		);
	}
}
