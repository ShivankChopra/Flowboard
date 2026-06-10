import { GrantMode } from "@prisma/client";
import { IsEnum } from "class-validator";

export class UpsertGrantDto {
	@IsEnum(GrantMode)
	mode!: GrantMode;
}
