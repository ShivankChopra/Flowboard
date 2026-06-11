import { Module } from "@nestjs/common";
import { DemoSeedService } from "./demo-seed";

@Module({
	providers: [DemoSeedService],
	exports: [DemoSeedService]
})
export class DemoModule {}
