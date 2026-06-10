import {
	ArrayNotEmpty,
	IsArray,
	IsUUID,
	ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

export class ReorderTasksColumnDto {
	@IsUUID()
	listId!: string;

	@IsUUID()
	statusId!: string;

	@IsArray()
	@IsUUID(undefined, { each: true })
	orderedTaskIds!: string[];
}

export class ReorderTasksDto {
	@IsArray()
	@ArrayNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => ReorderTasksColumnDto)
	columns!: ReorderTasksColumnDto[];
}
