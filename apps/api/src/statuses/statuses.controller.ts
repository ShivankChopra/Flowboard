import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreateStatusDto } from "./dto/create-status.dto";
import { UpdateStatusDto } from "./dto/update-status.dto";
import type { StatusDto } from "./status.dto";
import { StatusesService } from "./statuses.service";

@Controller("statuses")
export class StatusesController {
	constructor(private readonly statusesService: StatusesService) {}

	@Get()
	listStatuses(
		@CurrentUser() user: AuthenticatedUser,
		@Query("listId", ParseUUIDPipe) listId: string
	): Promise<StatusDto[]> {
		return this.statusesService.listStatuses(user, listId);
	}

	@Post()
	createStatus(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: CreateStatusDto
	): Promise<StatusDto> {
		return this.statusesService.createStatus(user, dto);
	}

	@Patch(":id")
	updateStatus(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: UpdateStatusDto
	): Promise<StatusDto> {
		return this.statusesService.updateStatus(user, id, dto);
	}

	@Delete(":id")
	@HttpCode(204)
	deleteStatus(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<void> {
		return this.statusesService.deleteStatus(user, id);
	}
}
