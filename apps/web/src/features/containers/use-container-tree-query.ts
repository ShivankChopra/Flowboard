import { useQuery } from "@tanstack/react-query";
import { getContainerTree } from "../../api/client";

export function useContainerTreeQuery(userId: string) {
	return useQuery({
		queryKey: ["containers", "tree", userId],
		queryFn: ({ signal }) => getContainerTree(userId, signal),
		staleTime: 20_000
	});
}

