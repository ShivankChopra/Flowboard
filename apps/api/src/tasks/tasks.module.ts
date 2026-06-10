import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
	imports: [PermissionsModule],
	controllers: [TasksController],
	providers: [TasksService]
})
export class TasksModule {}
