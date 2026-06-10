import { ContainerVisibility } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateContainerDto {
	@IsOptional()
	@IsString()
	@MaxLength(200)
	name?: string;

	@IsOptional()
	@IsEnum(ContainerVisibility)
	visibility?: ContainerVisibility;
}
