import type { Container, Grant } from "@prisma/client";

export type ContainerDto = {
	id: string;
	name: string;
	type: "workspace" | "space" | "folder" | "list";
	parentId: string | null;
	position: number;
	visibility: "public" | "private";
	isArchived: boolean;
	createdAt: string;
	updatedAt: string;
};

export type ContainerTreeNodeDto = Omit<ContainerDto, "createdAt" | "updatedAt"> & {
	children: ContainerTreeNodeDto[];
};

export type GrantDto = {
	id: string;
	resourceId: string;
	userId: string;
	mode: "allow" | "deny";
	createdAt: string;
	updatedAt: string;
};

export function toContainerDto(container: Container): ContainerDto {
	return {
		id: container.id,
		name: container.name,
		type: container.type,
		parentId: container.parentId,
		position: container.position,
		visibility: container.visibility,
		isArchived: container.isArchived,
		createdAt: container.createdAt.toISOString(),
		updatedAt: container.updatedAt.toISOString()
	};
}

export function toTreeNodeDto(
	container: Container,
	children: ContainerTreeNodeDto[]
): ContainerTreeNodeDto {
	return {
		id: container.id,
		name: container.name,
		type: container.type,
		parentId: container.parentId,
		position: container.position,
		visibility: container.visibility,
		isArchived: container.isArchived,
		children
	};
}

export function toGrantDto(grant: Grant): GrantDto {
	return {
		id: grant.id,
		resourceId: grant.resourceId,
		userId: grant.userId,
		mode: grant.mode,
		createdAt: grant.createdAt.toISOString(),
		updatedAt: grant.updatedAt.toISOString()
	};
}
