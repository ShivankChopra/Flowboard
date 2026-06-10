import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import { ErrorCode } from "../common/errors/error-code";
import { IS_PUBLIC_ROUTE } from "./public.decorator";
import type { AuthenticatedRequest } from "./auth.types";

@Injectable()
export class MockAuthGuard implements CanActivate {
	constructor(
		private readonly prisma: PrismaService,
		private readonly reflector: Reflector
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublicRoute = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
			context.getHandler(),
			context.getClass()
		]);

		if (isPublicRoute) {
			return true;
		}

		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const rawUserId = request.headers["x-user-id"];
		const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

		if (!userId) {
			throw new UnauthorizedException({
				code: ErrorCode.AuthRequired,
				message: "X-User-Id header is required."
			});
		}

		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				name: true,
				role: true
			}
		});

		if (!user) {
			throw new UnauthorizedException({
				code: ErrorCode.InvalidUser,
				message: `User '${userId}' does not exist.`
			});
		}

		request.user = user;
		return true;
	}
}
