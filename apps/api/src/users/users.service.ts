import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toUserDto, type UserDto } from "./user.dto";

@Injectable()
export class UsersService {
	constructor(private readonly prisma: PrismaService) {}

	async listUsers(): Promise<UserDto[]> {
		const users = await this.prisma.user.findMany({
			select: {
				id: true,
				name: true,
				role: true
			},
			orderBy: {
				id: "asc"
			}
		});

		return users.map(toUserDto);
	}
}
