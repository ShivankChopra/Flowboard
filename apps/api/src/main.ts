import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AppExceptionFilter } from "./common/errors/app-exception.filter";
import { createValidationException } from "./common/validation/validation-exception.factory";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.enableCors({
		origin: ["http://localhost:5173"]
	});
	app.useGlobalFilters(new AppExceptionFilter());
	app.useGlobalPipes(
		new ValidationPipe({
			forbidNonWhitelisted: true,
			transform: true,
			whitelist: true,
			exceptionFactory: createValidationException
		})
	);

	const port = Number(process.env.PORT ?? 3000);
	await app.listen(port, "0.0.0.0");
}

void bootstrap();
