import { StatusCategory } from "@prisma/client";
import {
	IsEnum,
	IsHexColor,
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min
} from "class-validator";

export class UpdateStatusDto {
	@IsOptional()
	@IsString()
	@MaxLength(80)
	name?: string;

	@IsOptional()
	@IsEnum(StatusCategory)
	category?: StatusCategory;

	@IsOptional()
	@IsHexColor()
	color?: string;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(1000)
	position?: number;
}
