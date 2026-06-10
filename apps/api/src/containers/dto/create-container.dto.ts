import { ContainerType, ContainerVisibility } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateContainerDto {
	@IsString()
	@MaxLength(200)
	name!: string;

	@IsEnum(ContainerType)
	type!: ContainerType;

	@IsUUID()
	parentId!: string;

	@IsOptional()
	@IsEnum(ContainerVisibility)
	visibility?: ContainerVisibility;
}
