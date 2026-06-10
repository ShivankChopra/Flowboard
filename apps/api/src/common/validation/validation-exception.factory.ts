import { BadRequestException } from "@nestjs/common";
import type { ValidationError } from "class-validator";
import { ErrorCode } from "../errors/error-code";

function collectValidationMessages(errors: ValidationError[], path = ""): string[] {
	return errors.flatMap((error) => {
		const fieldPath = path ? `${path}.${error.property}` : error.property;
		const ownMessages = Object.values(error.constraints ?? {}).map(
			(message) => `${fieldPath}: ${message}`
		);
		const childMessages = collectValidationMessages(error.children ?? [], fieldPath);

		return [...ownMessages, ...childMessages];
	});
}

export function createValidationException(errors: ValidationError[]) {
	const messages = collectValidationMessages(errors);

	return new BadRequestException({
		code: ErrorCode.ValidationError,
		message: messages.length > 0 ? messages.join("; ") : "Request validation failed."
	});
}
