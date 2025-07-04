import { type AsyncResult, Result } from "typescript-result";

class NotFoundError extends Error {
	readonly type = "not-found-error";
}

class UserNotActiveError extends Error {
	readonly type = "user-not-active-error";
}

class InvalidAuthMethodError extends Error {
	readonly type = "invalid-auth-method-error";
}

class InvalidOneTimePasswordError extends Error {
	readonly type = "invalid-one-time-password-error";
}

interface PasswordAuthMethod {
	type: "password";
	password: string;
}

interface OneTimePasswordAuthMethod {
	type: "one-time-password";
	challenge: {
		code: string;
		expiresAt: Date;
	} | null;
}

interface User {
	id: string;
	status: "active" | "inactive";
	email: string;
	authMethods: (PasswordAuthMethod | OneTimePasswordAuthMethod)[];
}

declare function findUserById(id: string): AsyncResult<User, NotFoundError>;

function verifyOneTimePassword(userId: string, code: string) {
	return Result.gen(function* () {
		const user = yield* findUserById(userId);

		if (user.status !== "active") {
			return Result.error(
				new UserNotActiveError("Cannot verify OTP for inactive user"),
			);
		}

		const authMethod = user.authMethods.find(
			(method) => method.type === "one-time-password",
		);
		if (!authMethod) {
			return Result.error(
				new InvalidAuthMethodError(
					"User has not configured one-time password as auth method",
				),
			);
		}

		if (!authMethod.challenge) {
			return Result.error(
				new InvalidAuthMethodError(
					"User has not requested a one-time password challenge",
				),
			);
		}

		if (authMethod.challenge.code !== code) {
			return Result.error(
				new InvalidOneTimePasswordError("Invalid one-time password"),
			);
		}

		return;
	});
}

await verifyOneTimePassword("user-id", "123456").fold(
	() => ({
		status: 200,
		message: "Login succeeded",
	}),
	(error) => {
		switch (error.type) {
			case "not-found-error":
				return {
					status: 404,
					message: `User not found: ${error.message}`,
				};

			case "user-not-active-error":
			case "invalid-auth-method-error":
			case "invalid-one-time-password-error":
				return {
					status: 401,
					message: error.message,
				};
		}
	},
);
