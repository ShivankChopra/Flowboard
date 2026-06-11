import { useQuery } from "@tanstack/react-query";
import { getContainerTree } from "../../api/client";

export function useContainerTreeQuery(userId: string, includeArchived = false) {
	return useQuery({
		queryKey: ["containers", "tree", userId, includeArchived],
		queryFn: ({ signal }) => getContainerTree(userId, signal, includeArchived),
		staleTime: 20_000
	});
}
