import { IsBoolean } from "class-validator";

export class ArchiveContainerDto {
	@IsBoolean()
	isArchived!: boolean;
}
