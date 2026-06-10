import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { StatusesController } from "./statuses.controller";
import { StatusesService } from "./statuses.service";

@Module({
	imports: [PermissionsModule],
	controllers: [StatusesController],
	providers: [StatusesService]
})
export class StatusesModule {}
