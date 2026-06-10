import { Controller, Get } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { toUserDto, type UserDto } from "./user.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get()
	listUsers(): Promise<UserDto[]> {
		return this.usersService.listUsers();
	}

	@Get("me")
	getMe(@CurrentUser() user: AuthenticatedUser): UserDto {
		return toUserDto(user);
	}
}
