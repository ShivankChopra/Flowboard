import { StatusCategory } from "@prisma/client";
import {
	IsEnum,
	IsHexColor,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min
} from "class-validator";

export class CreateStatusDto {
	@IsUUID()
	listId!: string;

	@IsString()
	@MaxLength(80)
	key!: string;

	@IsString()
	@MaxLength(80)
	name!: string;

	@IsEnum(StatusCategory)
	category!: StatusCategory;

	@IsHexColor()
	color!: string;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(1000)
	position?: number;
}
