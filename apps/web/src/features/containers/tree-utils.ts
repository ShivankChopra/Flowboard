import type { ContainerTreeNode } from "../../api/client";

export function flattenTree(nodes: ContainerTreeNode[]): ContainerTreeNode[] {
	return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

export function findContainer(
	nodes: ContainerTreeNode[],
	containerId: string | null
): ContainerTreeNode | null {
	if (!containerId) {
		return null;
	}

	for (const node of nodes) {
		if (node.id === containerId) {
			return node;
		}

		const match = findContainer(node.children, containerId);

		if (match) {
			return match;
		}
	}

	return null;
}

export function countLists(nodes: ContainerTreeNode[]): number {
	return flattenTree(nodes).filter((node) => node.type === "list").length;
}

export function countPrivateNodes(nodes: ContainerTreeNode[]): number {
	return flattenTree(nodes).filter((node) => node.visibility === "private").length;
}

export function getExpandableIds(nodes: ContainerTreeNode[]): string[] {
	return flattenTree(nodes)
		.filter((node) => node.children.length > 0)
		.map((node) => node.id);
}

