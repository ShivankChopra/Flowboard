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
import { CreateTaskDto } from "./dto/create-task.dto";
import { ListTasksQuery } from "./dto/list-tasks.query";
import { MoveTaskDto } from "./dto/move-task.dto";
import { ReorderTasksDto } from "./dto/reorder-tasks.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import type { PaginatedTasksResponse, TaskDto } from "./task.dto";
import { TasksService } from "./tasks.service";

@Controller("tasks")
export class TasksController {
	constructor(private readonly tasksService: TasksService) {}

	@Get()
	listTasks(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: ListTasksQuery
	): Promise<PaginatedTasksResponse> {
		return this.tasksService.listTasks(user, query);
	}

	@Get(":id")
	getTask(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<TaskDto> {
		return this.tasksService.getTask(user, id);
	}

	@Post()
	createTask(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: CreateTaskDto
	): Promise<TaskDto> {
		return this.tasksService.createTask(user, dto);
	}

	@Patch(":id")
	updateTask(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: UpdateTaskDto
	): Promise<TaskDto> {
		return this.tasksService.updateTask(user, id, dto);
	}

	@Post(":id/move")
	moveTask(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: MoveTaskDto
	): Promise<TaskDto> {
		return this.tasksService.moveTask(user, id, dto);
	}

	@Post("reorder")
	@HttpCode(204)
	reorderTasks(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: ReorderTasksDto
	): Promise<void> {
		return this.tasksService.reorderTasks(user, dto);
	}

	@Delete(":id")
	@HttpCode(204)
	deleteTask(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<void> {
		return this.tasksService.deleteTask(user, id);
	}
}
