import { ArrayNotEmpty, IsArray, IsUUID } from "class-validator";

export class ReorderContainerDto {
	@IsUUID()
	parentId!: string;

	@IsArray()
	@ArrayNotEmpty()
	@IsUUID(undefined, { each: true })
	orderedIds!: string[];
}
