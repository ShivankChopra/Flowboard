import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { ContainersModule } from "./containers/containers.module";
import { DemoModule } from "./demo/demo.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { PrismaModule } from "./prisma/prisma.module";
import { StatusesModule } from "./statuses/statuses.module";
import { TasksModule } from "./tasks/tasks.module";
import { UsersModule } from "./users/users.module";

@Module({
	imports: [
		PrismaModule,
		AuthModule,
		UsersModule,
		PermissionsModule,
		ContainersModule,
		StatusesModule,
		TasksModule,
		DemoModule
	],
	controllers: [AppController],
	providers: []
})
export class AppModule {}
