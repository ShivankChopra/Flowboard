import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus
} from "@nestjs/common";
import { ErrorCode } from "./error-code";

type ErrorResponse = {
	error: {
		code: string;
		message: string;
	};
};

type NestExceptionBody = string | {
	code?: string;
	error?: string;
	message?: string | string[];
};

function defaultCodeForStatus(status: number): string {
	switch (status) {
		case HttpStatus.UNAUTHORIZED:
			return ErrorCode.AuthRequired;
		case HttpStatus.FORBIDDEN:
			return ErrorCode.Forbidden;
		case HttpStatus.NOT_FOUND:
			return ErrorCode.NotFound;
		case HttpStatus.BAD_REQUEST:
			return ErrorCode.ValidationError;
		case HttpStatus.CONFLICT:
			return ErrorCode.Conflict;
		default:
			return ErrorCode.InternalServerError;
	}
}

function normalizeMessage(message: string | string[] | undefined, fallback: string): string {
	if (Array.isArray(message)) {
		return message.join("; ");
	}

	return message ?? fallback;
}

function normalizeHttpException(exception: HttpException): ErrorResponse {
	const status = exception.getStatus();
	const body = exception.getResponse() as NestExceptionBody;
	const fallbackMessage = exception.message || "Request failed.";

	if (typeof body === "string") {
		return {
			error: {
				code: defaultCodeForStatus(status),
				message: body
			}
		};
	}

	if (body && typeof body === "object") {
		return {
			error: {
				code: body.code ?? defaultCodeForStatus(status),
				message: normalizeMessage(body.message, body.error ?? fallbackMessage)
			}
		};
	}

	return {
		error: {
			code: defaultCodeForStatus(status),
			message: fallbackMessage
		}
	};
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
	catch(exception: unknown, host: ArgumentsHost) {
		const response = host.switchToHttp().getResponse();

		if (exception instanceof HttpException) {
			const status = exception.getStatus();
			response.status(status).json(normalizeHttpException(exception));
			return;
		}

		response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
			error: {
				code: ErrorCode.InternalServerError,
				message: "An unexpected error occurred."
			}
		});
	}
}
