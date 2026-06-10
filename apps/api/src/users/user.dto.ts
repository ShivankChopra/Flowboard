import type { AuthenticatedUser } from "../auth/auth.types";

export type UserDto = {
	id: string;
	name: string;
	role: "admin" | "member";
};

export function toUserDto(user: AuthenticatedUser): UserDto {
	return {
		id: user.id,
		name: user.name,
		role: user.role
	};
}
