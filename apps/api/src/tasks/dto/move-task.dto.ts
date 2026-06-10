import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class MoveTaskDto {
	@IsOptional()
	@IsUUID()
	targetListId?: string;

	@IsOptional()
	@IsUUID()
	targetStatusId?: string;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(10000)
	targetPosition?: number;
}
