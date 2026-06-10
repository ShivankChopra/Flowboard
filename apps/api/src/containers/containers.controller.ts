import {
	Body,
	Controller,
	DefaultValuePipe,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseBoolPipe,
	ParseUUIDPipe,
	Patch,
	Post,
	Put,
	Query
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import {
	type ContainerDto,
	type ContainerTreeNodeDto,
	type GrantDto
} from "./container.dto";
import { ContainersService } from "./containers.service";
import { ArchiveContainerDto } from "./dto/archive-container.dto";
import { CreateContainerDto } from "./dto/create-container.dto";
import { ReorderContainerDto } from "./dto/reorder-container.dto";
import { UpdateContainerDto } from "./dto/update-container.dto";
import { UpsertGrantDto } from "./dto/upsert-grant.dto";

@Controller("containers")
export class ContainersController {
	constructor(private readonly containersService: ContainersService) {}

	@Get("tree")
	getTree(
		@CurrentUser() user: AuthenticatedUser,
		@Query("includeArchived", new DefaultValuePipe(false), ParseBoolPipe)
		includeArchived: boolean
	): Promise<ContainerTreeNodeDto[]> {
		return this.containersService.getTree(user, includeArchived);
	}

	@Post()
	createContainer(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: CreateContainerDto
	): Promise<ContainerDto> {
		return this.containersService.createContainer(user, dto);
	}

	@Get(":id/grants")
	listGrants(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<GrantDto[]> {
		return this.containersService.listGrants(user, id);
	}

	@Put(":id/grants/:userId")
	upsertGrant(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Param("userId") userId: string,
		@Body() dto: UpsertGrantDto
	): Promise<GrantDto> {
		return this.containersService.upsertGrant(user, id, userId, dto);
	}

	@Delete(":id/grants/:userId")
	@HttpCode(204)
	deleteGrant(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Param("userId") userId: string
	): Promise<void> {
		return this.containersService.deleteGrant(user, id, userId);
	}

	@Post(":id/reorder")
	reorderContainer(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: ReorderContainerDto
	): Promise<ContainerDto[]> {
		return this.containersService.reorderContainer(user, id, dto);
	}

	@Patch(":id/archive")
	archiveContainer(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: ArchiveContainerDto
	): Promise<ContainerDto> {
		return this.containersService.archiveContainer(user, id, dto);
	}

	@Get(":id")
	getContainer(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<ContainerDto> {
		return this.containersService.getContainer(user, id);
	}

	@Patch(":id")
	updateContainer(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: UpdateContainerDto
	): Promise<ContainerDto> {
		return this.containersService.updateContainer(user, id, dto);
	}

	@Delete(":id")
	@HttpCode(204)
	deleteContainer(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<void> {
		return this.containersService.deleteContainer(user, id);
	}
}
