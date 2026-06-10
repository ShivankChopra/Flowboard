import { TaskPriority } from "@prisma/client";
import {
	IsArray,
	IsEnum,
	IsISO8601,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength
} from "class-validator";

export class UpdateTaskDto {
	@IsOptional()
	@IsString()
	@MaxLength(500)
	title?: string;

	@IsOptional()
	@IsString()
	description?: string | null;

	@IsOptional()
	@IsUUID()
	statusId?: string;

	@IsOptional()
	@IsEnum(TaskPriority)
	priority?: TaskPriority;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	assigneeIds?: string[];

	@IsOptional()
	@IsISO8601()
	dueDate?: string | null;
}
