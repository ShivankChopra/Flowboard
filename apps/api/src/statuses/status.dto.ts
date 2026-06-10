import type { Status } from "@prisma/client";

export type StatusDto = {
	id: string;
	listId: string;
	key: string;
	name: string;
	category: "todo" | "in_progress" | "done";
	color: string;
	position: number;
	isDefault: boolean;
	createdAt: string;
	updatedAt: string;
};

export function toStatusDto(status: Status): StatusDto {
	return {
		id: status.id,
		listId: status.listId,
		key: status.key,
		name: status.name,
		category: status.category,
		color: status.color,
		position: status.position,
		isDefault: status.isDefault,
		createdAt: status.createdAt.toISOString(),
		updatedAt: status.updatedAt.toISOString()
	};
}
