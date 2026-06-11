import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { AppModule } from "./app.module";
import { AppExceptionFilter } from "./common/errors/app-exception.filter";
import { createValidationException } from "./common/validation/validation-exception.factory";

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
	configureStaticWebApp(app);

	const port = Number(process.env.PORT ?? 3000);
	await app.listen(port, "0.0.0.0");
}

function configureStaticWebApp(app: NestExpressApplication) {
	const webDistPath = resolve(process.cwd(), "apps/web/dist");
	const indexPath = join(webDistPath, "index.html");

	if (!existsSync(indexPath)) {
		return;
	}

	app.useStaticAssets(webDistPath, { index: false });
	app.use(
		(
			request: { method: string; path: string; accepts: (type: string) => string | false },
			response: { sendFile: (path: string) => void },
			next: () => void
		) => {
			if (
				request.method !== "GET" ||
				isApiPath(request.path) ||
				!request.accepts("html")
			) {
				next();
				return;
			}

			response.sendFile(indexPath);
		}
	);
}

function isApiPath(pathname: string): boolean {
	const apiPrefixes = ["/health", "/users", "/containers", "/statuses", "/tasks"];

	return apiPrefixes.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	);
}

void bootstrap();
