import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { MockAuthGuard } from "./mock-auth.guard";

@Module({
	providers: [
		{
			provide: APP_GUARD,
			useClass: MockAuthGuard
		}
	]
})
export class AuthModule {}
