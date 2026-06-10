export const ErrorCode = {
	AuthRequired: "AUTH_REQUIRED",
	InvalidUser: "INVALID_USER",
	Forbidden: "FORBIDDEN",
	NotFound: "NOT_FOUND",
	ValidationError: "VALIDATION_ERROR",
	Conflict: "CONFLICT",
	InternalServerError: "INTERNAL_SERVER_ERROR"
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
