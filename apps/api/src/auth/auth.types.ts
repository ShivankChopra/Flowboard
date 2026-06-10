import type { UserRole } from "@prisma/client";

export type AuthenticatedUser = {
	id: string;
	name: string;
	role: UserRole;
};

export type AuthenticatedRequest = {
	headers: Record<string, string | string[] | undefined>;
	user?: AuthenticatedUser;
};
