import { Transform } from "class-transformer";
import {
	IsEnum,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min
} from "class-validator";

export enum TaskSort {
	position = "position",
	dueDate = "dueDate",
	priority = "priority"
}

export class ListTasksQuery {
	@IsUUID()
	listId!: string;

	@IsOptional()
	@Transform(({ value }) => Number(value))
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 50;

	@IsOptional()
	@Transform(({ value }) => Number(value))
	@IsInt()
	@Min(0)
	offset = 0;

	@IsOptional()
	@IsEnum(TaskSort)
	sort: TaskSort = TaskSort.position;

	@IsOptional()
	@IsIn(["asc", "desc"])
	direction: "asc" | "desc" = "asc";

	@IsOptional()
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MaxLength(200)
	q?: string;
}
