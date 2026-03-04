import { describe, expect, it } from "vitest";
import { assertUnreachable, NonExhaustiveError, Result } from "./index.js";

// -- Domain model --

interface Recipient {
	id: string;
	name: string;
	email: string;
	phone: string;
}

interface NotificationRequest {
	recipientId: string;
	message: string;
	channels: Channel[];
}

interface DeliveryReceipt {
	channel: Channel;
	recipientId: string;
	deliveredAt: Date;
}

type Channel = "email" | "sms" | "push";

class ValidationError extends Error {
	readonly type = "validation-error" as const;
}

class RecipientNotFoundError extends Error {
	readonly type = "recipient-not-found-error" as const;
}

class ProviderError extends Error {
	readonly type = "provider-error" as const;
	constructor(
		readonly channel: Channel,
		cause?: Error,
	) {
		super(`${channel} provider failed`, { cause });
	}
}

class ParseError extends Error {
	readonly type = "parse-error" as const;
}

class AllChannelsFailedError extends Error {
	readonly type = "all-channels-failed-error" as const;
	constructor(readonly channels: Channel[]) {
		super(`all channels failed: ${channels.join(", ")}`);
	}
}

// -- Recipient store (async in-memory) --

class RecipientStore {
	private recipients: Map<string, Recipient> = new Map();

	seed(recipient: Recipient) {
		this.recipients.set(recipient.id, recipient);
	}

	findById(id: string) {
		return Result.fromAsync(async () => {
			const recipient = this.recipients.get(id);
			if (!recipient) {
				return Result.error(
					new RecipientNotFoundError(`recipient ${id} not found`),
				);
			}
			return Result.ok(recipient);
		});
	}
}

// -- Provider factories (simulated external SDKs) --

function createEmailSender(shouldFail = false) {
	return (recipient: Recipient, _message: string): DeliveryReceipt => {
		if (shouldFail) throw new Error("SMTP connection refused");
		return {
			channel: "email",
			recipientId: recipient.id,
			deliveredAt: new Date("2026-03-04T12:00:00Z"),
		};
	};
}

function createSmsSender(shouldFail = false) {
	return (recipient: Recipient, _message: string): DeliveryReceipt => {
		if (shouldFail) throw new Error("SMS gateway timeout");
		return {
			channel: "sms",
			recipientId: recipient.id,
			deliveredAt: new Date("2026-03-04T12:00:01Z"),
		};
	};
}

function createAsyncPushSender(shouldFail = false) {
	return async (
		recipient: Recipient,
		_message: string,
	): Promise<DeliveryReceipt> => {
		if (shouldFail) throw new Error("Push token expired");
		return {
			channel: "push",
			recipientId: recipient.id,
			deliveredAt: new Date("2026-03-04T12:00:02Z"),
		};
	};
}

// -- Validation --

function validateRequest(
	request: NotificationRequest,
): Result<NotificationRequest, ValidationError> {
	if (!request.message.trim()) {
		return Result.error(new ValidationError("message cannot be empty"));
	}
	if (request.channels.length === 0) {
		return Result.error(new ValidationError("at least one channel required"));
	}
	return Result.ok(request);
}

function validateRecipientId(id: string): string {
	if (!/^[a-z0-9-]+$/.test(id)) {
		throw new ValidationError("invalid recipient id format");
	}
	return id;
}

// -- Notification service --

class NotificationService {
	constructor(
		private store: RecipientStore,
		private emailSender: ReturnType<typeof createEmailSender>,
		private smsSender: ReturnType<typeof createSmsSender>,
	) {}

	send(request: NotificationRequest) {
		const safeEmail = Result.wrap(
			this.emailSender,
			(err) => new ProviderError("email", err as Error),
		);

		return Result.gen(this, async function* () {
			const validated = yield* validateRequest(request);
			const recipient = yield* this.store.findById(validated.recipientId);
			return safeEmail(recipient, validated.message);
		});
	}

	sendToAllChannels(request: NotificationRequest) {
		const safeEmail = Result.wrap(
			this.emailSender,
			(err) => new ProviderError("email", err as Error),
		);
		const safeSms = Result.wrap(
			this.smsSender,
			(err) => new ProviderError("sms", err as Error),
		);

		return Result.gen(this, async function* () {
			const validated = yield* validateRequest(request);
			const recipient = yield* this.store.findById(validated.recipientId);

			return Result.all(
				safeEmail(recipient, validated.message),
				safeSms(recipient, validated.message),
			);
		});
	}

	sendWithFallback(request: NotificationRequest) {
		const safeEmail = Result.wrap(
			this.emailSender,
			(err) => new ProviderError("email", err as Error),
		);
		const safeSms = Result.wrap(
			this.smsSender,
			(err) => new ProviderError("sms", err as Error),
		);

		return Result.gen(this, async function* () {
			const validated = yield* validateRequest(request);
			const recipient = yield* this.store.findById(validated.recipientId);

			return safeEmail(recipient, validated.message).recover((emailErr) =>
				safeSms(recipient, validated.message).mapError(
					(smsErr) =>
						new AllChannelsFailedError([emailErr.channel, smsErr.channel]),
				),
			);
		});
	}

	parseConfig(json: string) {
		return Result.ok(json).mapCatching(
			(raw) => JSON.parse(raw) as { retries: number; timeout: number },
			(err) => new ParseError(`invalid config: ${(err as Error).message}`),
		);
	}
}

// -- Controller --

type ApiResponse<T> = { status: number; body: T };

class NotificationController {
	constructor(private service: NotificationService) {}

	async sendNotification(
		request: NotificationRequest,
	): Promise<ApiResponse<unknown>> {
		return this.service.send(request).fold(
			(receipt) => ({ status: 200, body: receipt }),
			(error) => {
				switch (error.type) {
					case "validation-error":
						return { status: 400, body: { message: error.message } };
					case "recipient-not-found-error":
						return { status: 404, body: { message: error.message } };
					case "provider-error":
						return { status: 502, body: { message: error.message } };
					default:
						return assertUnreachable(error);
				}
			},
		);
	}

	async sendNotificationWithMatch(
		request: NotificationRequest,
	): Promise<ApiResponse<unknown>> {
		const result = await this.service.send(request);
		if (result.ok) {
			return { status: 200, body: result.value };
		}

		return result
			.match()
			.when(
				ValidationError,
				(err) => ({ status: 400, body: { message: err.message } }) as const,
			)
			.when(
				RecipientNotFoundError,
				(err) => ({ status: 404, body: { message: err.message } }) as const,
			)
			.when(
				ProviderError,
				(err) => ({ status: 502, body: { message: err.message } }) as const,
			)
			.run();
	}
}

// -- Test fixtures --

const ALICE: Recipient = {
	id: "alice-01",
	name: "Alice",
	email: "alice@example.com",
	phone: "+31612345678",
};

function validRequest(
	overrides?: Partial<NotificationRequest>,
): NotificationRequest {
	return {
		recipientId: "alice-01",
		message: "Your order has shipped!",
		channels: ["email"],
		...overrides,
	};
}

function createTestSetup(opts?: { emailFails?: boolean; smsFails?: boolean }) {
	const store = new RecipientStore();
	store.seed(ALICE);
	const emailSender = createEmailSender(opts?.emailFails);
	const smsSender = createSmsSender(opts?.smsFails);
	const service = new NotificationService(store, emailSender, smsSender);
	const controller = new NotificationController(service);
	return { store, service, controller };
}

// -- Tests --

describe("Notification delivery pipeline", () => {
	describe("input validation", () => {
		it("accepts a valid request", () => {
			const result = validateRequest(validRequest());

			Result.assertOk(result);
			expect(result.value.message).toBe("Your order has shipped!");
			expect(result.getOrThrow()).toBe(result.value);
		});

		it("rejects an empty message", () => {
			const result = validateRequest(validRequest({ message: "" }));

			expect(result.ok).toBe(false);
			expect(result.errorOrNull()?.message).toBe("message cannot be empty");
		});

		it("rejects an invalid recipient id format via Result.try", () => {
			const result = Result.try(
				() => validateRecipientId("INVALID!!"),
				(err) => err as ValidationError,
			);

			const [value, error] = result.toTuple();
			expect(value).toBeNull();
			expect(error).toBeInstanceOf(ValidationError);
			expect(error?.message).toBe("invalid recipient id format");
		});
	});

	describe("recipient lookup", () => {
		it("finds an existing recipient", async () => {
			const { store } = createTestSetup();

			const result = await store.findById("alice-01");
			Result.assertOk(result);
			expect(result.getOrNull()?.name).toBe("Alice");
		});

		it("returns error for unknown recipient", async () => {
			const { store } = createTestSetup();

			const result = await store.findById("unknown-99");
			Result.assertError(result);
			expect(result.error).toBeInstanceOf(RecipientNotFoundError);
		});
	});

	describe("provider wrapping", () => {
		it("wraps a succeeding provider", () => {
			const safeSend = Result.wrap(
				createEmailSender(),
				(err) => new ProviderError("email", err as Error),
			);

			const result = safeSend(ALICE, "hello");
			expect(Result.isResult(result)).toBe(true);
			Result.assertOk(result);
			expect(result.value.channel).toBe("email");
		});

		it("captures a throwing provider", () => {
			const safeSend = Result.wrap(
				createEmailSender(true),
				(err) => new ProviderError("email", err as Error),
			);

			const result = safeSend(ALICE, "hello");
			Result.assertError(result);
			expect(result.error).toBeInstanceOf(ProviderError);
			expect(result.error.channel).toBe("email");
		});

		it("captures async provider rejection", async () => {
			const result = await Result.fromAsyncCatching(
				createAsyncPushSender(true)(ALICE, "hello"),
				(err) => new ProviderError("push", err as Error),
			);

			Result.assertError(result);
			expect(result.error).toBeInstanceOf(ProviderError);
			expect(result.error.channel).toBe("push");
		});
	});

	describe("gen pipeline - send", () => {
		it("sends successfully through the pipeline", async () => {
			const { service } = createTestSetup();
			const auditLog: string[] = [];

			const result = await service.send(validRequest()).onSuccess((receipt) => {
				auditLog.push(`delivered via ${receipt.channel}`);
			});

			Result.assertOk(result);
			expect(result.value.channel).toBe("email");
			expect(result.value.recipientId).toBe("alice-01");
			expect(auditLog).toEqual(["delivered via email"]);
		});

		it("short-circuits on validation failure", async () => {
			const { service } = createTestSetup();

			const result = await service.send(validRequest({ message: "" }));

			Result.assertError(result);
			expect(result.error).toBeInstanceOf(ValidationError);
		});

		it("short-circuits on recipient not found", async () => {
			const { service } = createTestSetup();

			const result = await service.send(
				validRequest({ recipientId: "unknown-99" }),
			);

			Result.assertError(result);
			expect(result.error).toBeInstanceOf(RecipientNotFoundError);
		});
	});

	describe("parallel dispatch", () => {
		it("dispatches to all channels successfully", async () => {
			const { service } = createTestSetup();

			const result = await service.sendToAllChannels(
				validRequest({ channels: ["email", "sms"] }),
			);

			Result.assertOk(result);
			expect(result.value).toHaveLength(2);
			expect(result.value[0].channel).toBe("email");
			expect(result.value[1].channel).toBe("sms");
		});

		it("captures throwing channel via allCatching", () => {
			const result = Result.allCatching(Result.ok("stable"), (() => {
				throw new Error("boom");
			}) as () => string);

			Result.assertError(result);
			expect(result.error).toBeInstanceOf(Error);
		});
	});

	describe("fallback and recovery", () => {
		it("falls back to SMS when email fails", async () => {
			const { service } = createTestSetup({ emailFails: true });

			const result = await service.sendWithFallback(validRequest());

			Result.assertOk(result);
			expect(result.value.channel).toBe("sms");
		});

		it("wraps a fallback that throws via recoverCatching", () => {
			const failing = Result.error(new ProviderError("email")) as Result<
				DeliveryReceipt,
				ProviderError
			>;

			const result = failing.recoverCatching(
				(): DeliveryReceipt => {
					throw new Error("fallback also failed");
				},
				(err) => new ProviderError("sms", err as Error),
			);

			Result.assertError(result);
			expect(result.error).toBeInstanceOf(ProviderError);
			expect(result.error.channel).toBe("sms");
		});

		it("transforms error via mapError", () => {
			const failing = Result.error(new ProviderError("email")) as Result<
				DeliveryReceipt,
				ProviderError
			>;

			const result = failing.mapError(
				(err) => new AllChannelsFailedError([err.channel]),
			);

			Result.assertError(result);
			expect(result.error).toBeInstanceOf(AllChannelsFailedError);
			expect(result.error.channels).toEqual(["email"]);
		});
	});

	describe("config parsing", () => {
		it("parses valid JSON via mapCatching", () => {
			const { service } = createTestSetup();

			const result = service.parseConfig('{"retries":3,"timeout":5000}');

			Result.assertOk(result);
			expect(result.value).toEqual({ retries: 3, timeout: 5000 });
		});

		it("captures malformed JSON with transformError", () => {
			const { service } = createTestSetup();

			const result = service.parseConfig("{invalid json}");

			Result.assertError(result);
			expect(result.error).toBeInstanceOf(ParseError);
			expect(result.error.message).toContain("invalid config:");
		});
	});

	describe("genCatching", () => {
		it("captures unexpected throw inside generator", async () => {
			const result = await Result.genCatching(
				(async function* () {
					yield* Result.ok("step 1");
					throw new Error("unexpected explosion");
				})(),
			);

			Result.assertError(result);
			expect(result.error).toBeInstanceOf(Error);
			expect((result.error as Error).message).toBe("unexpected explosion");
		});
	});

	describe("controller responses", () => {
		it("folds success to 200", async () => {
			const { controller } = createTestSetup();

			const response = await controller.sendNotification(validRequest());

			expect(response.status).toBe(200);
			expect((response.body as DeliveryReceipt).channel).toBe("email");
		});

		it("folds validation error to 400 with assertUnreachable default", async () => {
			const { controller } = createTestSetup();

			const response = await controller.sendNotification(
				validRequest({ message: "" }),
			);

			expect(response.status).toBe(400);
			expect((response.body as { message: string }).message).toBe(
				"message cannot be empty",
			);
		});

		it("handles errors exhaustively via match().when().run()", async () => {
			const { controller } = createTestSetup({ emailFails: true });

			const response = await controller.sendNotificationWithMatch(
				validRequest(),
			);

			expect(response.status).toBe(502);
			expect((response.body as { message: string }).message).toBe(
				"email provider failed",
			);
		});

		it("throws NonExhaustiveError when cases are missing at runtime", () => {
			const result = Result.error(new ParseError("oops"));

			// TS correctly prevents calling .run() when not exhaustive,
			// so we bypass with a cast to verify runtime behavior
			const matcher = result.match() as any;
			expect(() => matcher.run()).toThrow(NonExhaustiveError);
		});
	});

	describe("extraction patterns", () => {
		it("getOrDefault returns fallback on error", () => {
			const failing = Result.error(new ProviderError("email")) as Result<
				DeliveryReceipt,
				ProviderError
			>;

			const receipt = failing.getOrDefault({
				channel: "email",
				recipientId: "fallback",
				deliveredAt: new Date(0),
			});

			expect(receipt.recipientId).toBe("fallback");
		});

		it("getOrElse computes fallback from error", () => {
			const failing = Result.error(new ProviderError("sms")) as Result<
				string,
				ProviderError
			>;

			const message = failing.getOrElse((err) => `failed on ${err.channel}`);

			expect(message).toBe("failed on sms");
		});

		it("identifies AsyncResult via type guard", () => {
			const asyncResult = Result.fromAsync(async () => Result.ok(42));

			expect(Result.isAsyncResult(asyncResult)).toBe(true);
			expect(Result.isAsyncResult(Result.ok(42))).toBe(false);
		});
	});

	describe("side effects", () => {
		it("onFailure triggers on error result", async () => {
			const { service } = createTestSetup({ emailFails: true });
			const errorLog: string[] = [];

			const result = await service.send(validRequest()).onFailure((err) => {
				errorLog.push(err.message);
			});

			Result.assertError(result);
			expect(errorLog).toEqual(["email provider failed"]);
		});
	});
});
