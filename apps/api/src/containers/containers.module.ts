import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { ContainersController } from "./containers.controller";
import { ContainersService } from "./containers.service";

@Module({
	imports: [PermissionsModule],
	controllers: [ContainersController],
	providers: [ContainersService]
})
export class ContainersModule {}
