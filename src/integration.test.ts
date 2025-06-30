import { describe, expect, it } from "vitest";
import { assertUnreachable } from "./helpers.js";
import { Result } from "./result.js";

describe("User management app", () => {
	let count = 0;

	const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
	const isValidName = (name: string) => name.length > 3 && name.length < 10;

	class ValidationError extends Error {
		readonly type = "validation-error";
	}

	class NotFoundError extends Error {
		readonly type = "not-found-error";
	}

	class EmailAlreadyExistsError extends Error {
		readonly type = "email-already-exists-error";
	}

	class UserDto {
		constructor(
			readonly id: number,
			readonly name: string,
			readonly email: string,
		) {}

		static fromUser(user: User) {
			return new UserDto(user.id, user.name, user.email);
		}
	}

	class User {
		private _name: string;
		private _email: string;

		private constructor(
			readonly id: number,
			name: string,
			email: string,
		) {
			this._name = name;
			this._email = email;
		}

		get name() {
			return this._name;
		}

		get email() {
			return this._email;
		}

		updateEmail(email: string) {
			if (!isValidEmail(email)) {
				return Result.error(new ValidationError("invalid email"));
			}

			this._email = email;
			return Result.ok(this);
		}

		static create(name: string, email: string) {
			if (!isValidName(name)) {
				return Result.error(new ValidationError("invalid name"));
			}

			if (!isValidEmail(email)) {
				return Result.error(new ValidationError("invalid email"));
			}

			return Result.ok(new User(count++, name, email));
		}
	}

	class UserRepository {
		private users: Record<number, User> = {};

		async save(user: User) {
			this.users[user.id] = user;
		}

		findById(id: number) {
			return Result.fromAsync(async () => {
				const possibleUser = this.users[id];
				if (!possibleUser) {
					return Result.error(
						new NotFoundError(`Cannot find user with id ${id}`),
					);
				}

				return Result.ok(possibleUser);
			});
		}

		async existsByEmail(email: string) {
			return Object.values(this.users).some((user) => user.email === email);
		}
	}

	class UserService {
		constructor(private userRepository: UserRepository) {}

		createUser(name: string, email: string) {
			return Result.fromAsync(this.userRepository.existsByEmail(email))
				.map((exists) =>
					exists ? Result.error(new EmailAlreadyExistsError()) : Result.ok(),
				)
				.map(() => User.create(name, email))
				.onSuccess((user) => this.userRepository.save(user))
				.map(UserDto.fromUser);
		}

		updateUserEmail(id: number, email: string) {
			return this.userRepository
				.findById(id)
				.map((user) => user.updateEmail(email))
				.onSuccess((user) => this.userRepository.save(user))
				.map(UserDto.fromUser);
		}
	}

	class UserController {
		constructor(private userService: UserService) {}

		createUser(name: string, email: string) {
			return this.userService.createUser(name, email).fold(
				(user) => ({ status: 200 as const, data: user }),
				(error) => {
					switch (error.type) {
						case "validation-error":
							return { status: 400 as const, data: { message: error.message } };
						case "email-already-exists-error":
							return {
								status: 409 as const,
								data: { message: "account with same email already exists" },
							};
						default:
							return assertUnreachable(error);
					}
				},
			);
		}

		updateUserEmail(id: number, email: string) {
			return this.userService.updateUserEmail(id, email).fold(
				(user) => ({ status: 200, data: user }),
				(error) => {
					switch (error.type) {
						case "not-found-error":
							return { status: 404, data: { message: error.message } };
						case "validation-error":
							return { status: 400, data: { message: error.message } };
						default:
							return assertUnreachable(error);
					}
				},
			);
		}
	}

	const createApp = () =>
		new UserController(new UserService(new UserRepository()));

	it("creates a new user when the correct data is provided", async () => {
		const app = createApp();
		const outcome = await app.createUser("John", "info@john.com");

		expect(outcome).toEqual({
			status: 200,
			data: { id: 0, name: "John", email: "info@john.com" },
		});
	});

	it("does not create a new user when the e-mailaddress does not match the correct pattern", async () => {
		const app = createApp();
		const outcome = await app.createUser("John", "invalidemail.com");

		expect(outcome).toEqual({
			status: 400,
			data: { message: "invalid email" },
		});
	});

	it("does not create a new user when the name is too short", async () => {
		const app = createApp();
		const outcome = await app.createUser("Jo", "info@john.com");

		expect(outcome).toEqual({
			status: 400,
			data: { message: "invalid name" },
		});
	});

	it("does not create a new user when the e-mailaddress is already in use", async () => {
		const app = createApp();

		const firstUserOutcome = await app.createUser("John", "info@john.com");
		expect(firstUserOutcome.status).toBe(200);

		const secondUserOutcome = await app.createUser("John", "info@john.com");
		expect(secondUserOutcome).toEqual({
			status: 409,
			data: { message: "account with same email already exists" },
		});
	});

	it("updates the e-mailaddress of a user", async () => {
		const app = createApp();
		const createOutcome = await app.createUser("John", "info@john.com");
		expect(createOutcome.status).toBe(200);

		const id = (createOutcome.data as UserDto).id;

		const updateOutcome = await app.updateUserEmail(id, "new@john.com");
		expect(updateOutcome).toEqual({
			status: 200,
			data: { id, name: "John", email: "new@john.com" },
		});
	});

	it("does not update the e-mailaddress of a user when the e-mailaddress does not match the correct pattern", async () => {
		const app = createApp();
		const createOutcome = await app.createUser("John", "info@john.com");
		expect(createOutcome.status).toBe(200);

		const id = (createOutcome.data as UserDto).id;

		const updateOutcome = await app.updateUserEmail(id, "invalid.com");
		expect(updateOutcome).toEqual({
			status: 400,
			data: { message: "invalid email" },
		});
	});

	it("does not update the e-mailaddress of a user the user does not exist", async () => {
		const app = createApp();
		const updateOutcome = await app.updateUserEmail(2, "info@john.com");
		expect(updateOutcome).toEqual({
			status: 404,
			data: { message: "Cannot find user with id 2" },
		});
	});
});
