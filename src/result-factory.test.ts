import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { AsyncResult, Result } from "./index.js";

class CustomError extends Error {}

class ErrorA extends Error {
	readonly type = "a";
}

class ErrorB extends Error {
	readonly type = "b";
}

const errorA = new ErrorA("some error");

const sleep = () => new Promise((resolve) => setTimeout(resolve, 10));

describe("Result", () => {
	describe("Result.isResult", () => {
		it("checks whether an object is a instance of Result", () => {
			const result = Result.ok(42);

			const possibleResult = result as Result<number, ErrorA> | Date;

			expect(Result.isResult(possibleResult)).toBe(true);

			if (Result.isResult(possibleResult)) {
				expectTypeOf(possibleResult).toEqualTypeOf<Result<number, ErrorA>>();
			}
		});
	});

	describe("Result.isAsyncResult", () => {
		it("checks whether an object is a instance of AsyncResult", () => {
			const result = AsyncResult.fromPromise(Promise.resolve(42));

			const possibleResult = result as AsyncResult<number, ErrorA> | Date;

			expect(Result.isAsyncResult(possibleResult)).toBe(true);

			if (Result.isAsyncResult(possibleResult)) {
				expectTypeOf(possibleResult).toEqualTypeOf<
					AsyncResult<number, ErrorA>
				>();
			}
		});
	});

	describe("Result.ok", () => {
		it("encapsulates a successful value", () => {
			const myResult: Result<number, ErrorA> = Result.ok(42);

			expect(myResult.value).toBe(42);
			expect(myResult.error).toBeUndefined();
			expect(myResult.isResult).toBe(true);
			expect(myResult.isOk()).toBe(true);
			expect(myResult.isError()).toBe(false);
		});
	});

	describe("Result.assertOk", () => {
		it("throws an error if the result is a failure", () => {
			const myResult: Result<number, ErrorA> = Result.error(errorA);

			expect(() => Result.assertOk(myResult)).toThrow();

			const okResult = Result.ok(42);
			Result.assertOk(okResult);
			expectTypeOf(okResult).toEqualTypeOf<Result.Ok<number>>();
		});
	});

	describe("Result.error", () => {
		it("encapsulates a value that indicates a failure", () => {
			const myResult: Result<number, ErrorA> = Result.error(errorA);

			expect(myResult.value).toBeUndefined();
			expect(myResult.error).toEqual(errorA);
			expect(myResult.isResult).toBe(true);
			expect(myResult.isOk()).toBe(false);
			expect(myResult.isError()).toBe(true);
		});
	});

	describe("Result.assertFailure", () => {
		it("throws an error if the result is ok", () => {
			const myResult: Result<number, ErrorA> = Result.ok(12);

			expect(() => Result.assertError(myResult)).toThrow();

			const failureResult = Result.error(errorA);
			Result.assertError(failureResult);
			expectTypeOf(failureResult).toEqualTypeOf<Result.Error<ErrorA>>();
		});
	});

	describe("Result.try", () => {
		it("sets the correct types", () => {
			const syncResult = Result.try(() => "some value");
			expectTypeOf(syncResult).toEqualTypeOf<Result<string, Error>>();

			const asyncResult = Result.try(async () => "some value");
			expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<string, Error>>();

			const syncResultFlattened = Result.try(
				() => Result.ok("some value") as Result<string, ErrorA>,
			);
			expectTypeOf(syncResultFlattened).toEqualTypeOf<
				Result<string, Error | ErrorA>
			>();

			const asyncResultFlattened = Result.try(
				async () => Result.ok("some value") as Result<string, ErrorA>,
			);
			expectTypeOf(asyncResultFlattened).toEqualTypeOf<
				AsyncResult<string, Error | ErrorA>
			>();

			const generatorResultA = Result.try(function* () {
				return "string literal";
			});
			expectTypeOf(generatorResultA).toEqualTypeOf<Result<string, Error>>();

			const generatorResultB = Result.try(function* () {
				return Result.ok("some value");
			});
			expectTypeOf(generatorResultB).toEqualTypeOf<Result<string, Error>>();

			const generatorResultC = Result.try(async function* () {
				return "string literal";
			});
			expectTypeOf(generatorResultC).toEqualTypeOf<
				AsyncResult<string, Error>
			>();

			const generatorResultD = Result.try(
				async function* () {
					return Result.ok("some value");
				},
				(error) => new ErrorA("my message", { cause: error }),
			);
			expectTypeOf(generatorResultD).toEqualTypeOf<
				AsyncResult<string, ErrorA>
			>();
		});

		it("executes a provided callback and wraps an successful outcome in a result", () => {
			const result = Result.try(() => "some value");
			Result.assertOk(result);
			expect(result.value).toBe("some value");
		});

		it("executes a provided async-callback and wraps an successful outcome in a async-result", async () => {
			const asyncResult = Result.try(async () => "some value");

			expect(asyncResult).toBeInstanceOf(AsyncResult);

			const result = await asyncResult;

			Result.assertOk(result);
			expectTypeOf(result.value).toBeString();
			expect(result.value).toBe("some value");
		});

		it("executes a provided callback and wraps a failed outcome in a result", () => {
			const result = Result.try(() => {
				throw new CustomError();

				// biome-ignore lint/correctness/noUnreachable: needed in order to infer the correct return type
				return "some value";
			});

			Result.assertError(result);
			expect(result.error).toBeInstanceOf(CustomError);
		});

		it("lets you transform the error before it is returned as a result", () => {
			const result = Result.try(
				(): number => {
					throw new Error();
				},
				(error) => new ErrorA("my message", { cause: error }),
			);

			expectTypeOf(result).toEqualTypeOf<Result<number, ErrorA>>();
			expect(result.error).toBeInstanceOf(ErrorA);
		});

		it("lets you transform the error before it is returned as a result given an async function", async () => {
			const result = Result.try(
				async (): Promise<number> => {
					throw new Error();
				},
				(error) => new ErrorA("my message", { cause: error }),
			);

			expectTypeOf(result).toEqualTypeOf<AsyncResult<number, ErrorA>>();
			expect((await result).error).toBeInstanceOf(ErrorA);
		});

		it("executes a provided async-callback and wraps a failed outcome in a async-result", async () => {
			const asyncResult = Result.try(async () => {
				throw new CustomError();

				// biome-ignore lint/correctness/noUnreachable: needed in order to infer the correct return type
				return "some value";
			});

			expect(asyncResult).toBeInstanceOf(AsyncResult);

			const result = await asyncResult;
			Result.assertError(result);
			expect(result.error).toBeInstanceOf(CustomError);
		});

		it("throws when exceptions are encountered in the transform function", async () => {
			await expect(() =>
				Result.try(
					async (): Promise<number> => {
						throw new CustomError();
					},
					(error) => {
						throw error;
					},
				),
			).rejects.toThrow(CustomError);
		});

		it("flattens another result-type when returned by the provided callback", () => {
			const resultA = Result.try(() => Result.ok("some value"));
			const resultB = Result.try(() => Result.error(new CustomError()));

			Result.assertOk(resultA);
			expect(resultA.value).toBe("some value");

			Result.assertError(resultB);
			expect(resultB.error).toBeInstanceOf(CustomError);
		});

		it("flattens another result-type when returned by the provided async-callback", async () => {
			const asyncResultA = Result.try(async () => Result.ok("some value"));
			const asyncResultB = Result.try(async () =>
				Result.error(new CustomError()),
			);

			expect(asyncResultA).toBeInstanceOf(AsyncResult);
			expect(asyncResultB).toBeInstanceOf(AsyncResult);

			const resultA = await asyncResultA;
			Result.assertOk(resultA);
			expect(resultA.value).toBe("some value");

			const resultB = await asyncResultB;
			Result.assertError(resultB);
			expect(resultB.error).toBeInstanceOf(CustomError);
		});

		it("executes a provided generator function and returns a result", () => {
			const result = Result.try(function* () {
				const a = yield* Result.ok(1);
				const b = yield* Result.ok(2);

				return a + b;
			});

			expectTypeOf(result).toEqualTypeOf<Result<number, Error>>();
			Result.assertOk(result);
			expect(result.value).toBe(3);
		});

		it("executes a provided generator function and returns a failed result when an error is thrown", () => {
			const result = Result.try(function* () {
				const a = yield* Result.ok(12);
				throw new CustomError();

				// biome-ignore lint/correctness/noUnreachable: for testing purposes
				return a;
			});

			expectTypeOf(result).toEqualTypeOf<Result<number, Error>>();
			Result.assertError(result);
			expect(result.error).toBeInstanceOf(CustomError);
		});

		it("executes a provided async generator function and returns a async-result", async () => {
			const asyncResult = Result.try(async function* () {
				const a = yield* Result.ok(1);
				const b = yield* AsyncResult.ok(2);

				return a + b;
			});

			expect(asyncResult).toBeInstanceOf(AsyncResult);
			expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<number, Error>>();

			const result = await asyncResult;
			Result.assertOk(result);
			expect(result.value).toBe(3);
		});

		it("executes a provided async generator function and returns a failed async-result when an error is thrown", async () => {
			const asyncResult = Result.try(async function* () {
				const a = yield* Result.ok(12);
				throw new CustomError();

				// biome-ignore lint/correctness/noUnreachable: for testing purposes
				return a;
			});

			expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<number, Error>>();

			const result = await asyncResult;
			Result.assertError(result);
			expect(result.error).toBeInstanceOf(CustomError);
		});
	});

	describe("Result.wrap", () => {
		it("sets the correct types", () => {
			const wrappedSum = Result.wrap((a: number, b: number) => a + b);
			expectTypeOf(wrappedSum).parameters.toEqualTypeOf<[number, number]>();
			expectTypeOf(wrappedSum).returns.toEqualTypeOf<Result<number, Error>>();

			const asyncWrappedSum = Result.wrap(
				async (a: number, b: number) => a + b,
			);
			expectTypeOf(asyncWrappedSum).parameters.toEqualTypeOf<
				[number, number]
			>();
			expectTypeOf(asyncWrappedSum).returns.toEqualTypeOf<
				AsyncResult<number, Error>
			>();
		});

		it("returns a function that executes a given function and returns the successful outcome in a result", () => {
			function sum(a: number, b: number) {
				return a + b;
			}
			const wrappedSum = Result.wrap(sum);

			const result = wrappedSum(1, 2);
			Result.assertOk(result);
			expect(result.value).toBe(3);
		});

		it("returns a function executes a given function and returns a failed outcome in a result", () => {
			function sum(a: number, b: number) {
				throw new CustomError();

				// biome-ignore lint/correctness/noUnreachable: needed in order to infer the correct return type
				return a + b;
			}
			const wrappedSum = Result.wrap(sum);
			const result = wrappedSum(1, 2);

			Result.assertError(result);
			expect(result.error).toBeInstanceOf(CustomError);
		});

		it("returns an async-function that executes a given async-function and returns the successful outcome in a async-result", async () => {
			async function sum(a: number, b: number) {
				return a + b;
			}
			const wrappedSum = Result.wrap(sum);
			const asyncResult = wrappedSum(1, 2);

			expect(asyncResult).toBeInstanceOf(AsyncResult);
			const result = await asyncResult;
			Result.assertOk(result);
			expect(result.value).toBe(3);
		});

		it("returns an async-function that executes a given async-function and returns the failed outcome in a async-result", async () => {
			async function sum(a: number, b: number) {
				throw new CustomError();

				// biome-ignore lint/correctness/noUnreachable: needed in order to infer the correct return type
				return a + b;
			}
			const wrappedSum = Result.wrap(sum);
			const asyncResult = wrappedSum(1, 2);

			expect(asyncResult).toBeInstanceOf(AsyncResult);
			const result = await asyncResult;
			Result.assertError(result);
			expect(result.error).toBeInstanceOf(CustomError);
		});

		it("allows you to transform the error before it is returned as a result", () => {
			function sum(a: number, b: number) {
				throw new Error("boom");

				// biome-ignore lint/correctness/noUnreachable: needed in order to infer the correct return type
				return a + b;
			}
			const wrappedSum = Result.wrap(
				sum,
				(error) => new ErrorA("my message", { cause: error }),
			);
			const result = wrappedSum(1, 2);

			Result.assertError(result);
			expect(result.error).toBeInstanceOf(ErrorA);
			expect(result.error).toEqual(
				new ErrorA("my message", { cause: new Error("boom") }),
			);
		});
	});

	describe("Result.allCatching", () => {
		it("takes multiple values and combines it into one successful result", () => {
			const result = Result.allCatching("a", "b", "c");
			expectTypeOf(result).toEqualTypeOf<
				Result<[string, string, string], never>
			>();

			Result.assertOk(result);
			expect(result.value).toEqual(["a", "b", "c"]);
		});

		it("takes multiple successful results and combines it into one successful result", () => {
			const result = Result.allCatching(
				Result.ok("a"),
				Result.ok("b"),
				Result.ok("c"),
			);

			expectTypeOf(result).toEqualTypeOf<
				Result<[string, string, string], never>
			>();

			Result.assertOk(result);
			expect(result.value).toEqual(["a", "b", "c"]);
		});

		it("takes multiple functions and combines it into one successful result", () => {
			const result = Result.allCatching(
				() => Result.ok("a"),
				() => Result.ok("b"),
				() => Result.ok("c"),
			);

			expectTypeOf(result).toEqualTypeOf<
				Result<[string, string, string], Error>
			>();

			Result.assertOk(result);
			expect(result.value).toEqual(["a", "b", "c"]);
		});

		it("takes different kinds of values and combines it into one successful result", () => {
			const result = Result.allCatching("a", Result.ok("b"), () =>
				Result.ok("c"),
			);

			expectTypeOf(result).toEqualTypeOf<
				Result<[string, string, string], Error>
			>();

			Result.assertOk(result);
			expect(result.value).toEqual(["a", "b", "c"]);
		});

		it("takes a single successful async-result and combines it into one successful async-result", async () => {
			const asyncResult = Result.try(async () => "some value");

			const asyncAllResult = Result.allCatching(asyncResult);

			expectTypeOf(asyncAllResult).toEqualTypeOf<
				AsyncResult<[string], Error>
			>();

			expect(asyncAllResult).toBeInstanceOf(AsyncResult);

			const result = await asyncAllResult;
			Result.assertOk(result);
			expect(result.value).toEqual(["some value"]);
		});

		it("takes a successful promise and combines it into one successful async-result", async () => {
			const asyncAllResult = Result.allCatching(Promise.resolve("some value"));

			expectTypeOf(asyncAllResult).toEqualTypeOf<
				AsyncResult<[string], Error>
			>();

			expect(asyncAllResult).toBeInstanceOf(AsyncResult);

			const result = await asyncAllResult;
			Result.assertOk(result);
			expect(result.value).toEqual(["some value"]);
		});

		it("takes different kinds of async-like parameters and combines it into one result", async () => {
			const asyncAllResult = Result.allCatching(
				Promise.resolve("a"),
				Result.try(async () => "b"),
				() => Result.try(async () => "c"),
				async () => "d",
			);

			expectTypeOf(asyncAllResult).toEqualTypeOf<
				AsyncResult<[string, string, string, string], Error>
			>();

			expect(asyncAllResult).toBeInstanceOf(AsyncResult);

			const result = await asyncAllResult;
			Result.assertOk(result);
			expect(result.value).toEqual(["a", "b", "c", "d"]);
		});

		it("combines both sync and async values into one result", async () => {
			const asyncAllResult = Result.allCatching(
				"a",
				Promise.resolve("b"),
				Result.ok("c"),
				Result.try(async () => "d"),
				() => "e",
				() => Result.try(async () => "f"),
				() => Result.ok("g"),
				async () => "h",
			);

			expectTypeOf(asyncAllResult).toEqualTypeOf<
				AsyncResult<
					[string, string, string, string, string, string, string, string],
					Error
				>
			>();

			expect(asyncAllResult).toBeInstanceOf(AsyncResult);
			const result = await asyncAllResult;
			Result.assertOk(result);
			expect(result.value).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
		});

		it("fails eagerly when a function throws an error", () => {
			function functionThatThrows(): number {
				throw new CustomError();
			}

			const functionThatReturnsString: () => string = vi
				.fn()
				.mockReturnValue("some value");

			const allResult = Result.allCatching(
				functionThatThrows,
				functionThatReturnsString,
			);

			expectTypeOf(allResult).toEqualTypeOf<Result<[number, string], Error>>();

			Result.assertError(allResult);
			expect(allResult.error).toBeInstanceOf(CustomError);
			expect(functionThatReturnsString).not.toHaveBeenCalled();
		});

		it("fails eagerly when an item is a failure", () => {
			const functionThatReturnsString: () => string = vi
				.fn()
				.mockReturnValue("some value");

			const allResult = Result.allCatching(
				Result.error(new CustomError()) as Result<number, CustomError>,
				functionThatReturnsString,
			);

			expectTypeOf(allResult).toEqualTypeOf<
				Result<[number, string], Error | CustomError>
			>();

			Result.assertError(allResult);
			expect(allResult.error).toBeInstanceOf(CustomError);
			expect(functionThatReturnsString).not.toHaveBeenCalled();
		});

		it("fails eagerly when one of the items is a pending async-result", async () => {
			const functionThatReturnsString: () => string = vi
				.fn()
				.mockReturnValue("some value");

			const asyncAllResult = Result.allCatching(
				Result.error(new CustomError()) as Result<string, CustomError>,
				functionThatReturnsString,
				Result.try(async () => "async-promise"),
			);

			expectTypeOf(asyncAllResult).toEqualTypeOf<
				AsyncResult<[string, string, string], CustomError | Error>
			>();

			expect(asyncAllResult).toBeInstanceOf(AsyncResult);
			const result = await asyncAllResult;

			Result.assertError(result);
			expect(result.error).toBeInstanceOf(CustomError);
			expect(functionThatReturnsString).not.toHaveBeenCalled();
		});

		it("fails eagerly when a function returns an error while async items are present", async () => {
			const functionThatReturnsString: () => string = vi
				.fn()
				.mockReturnValue("some value");

			const asyncAllResult = Result.allCatching(
				Promise.resolve("a"),
				() => Result.error(new CustomError()) as Result<number, CustomError>,
				functionThatReturnsString,
			);

			expectTypeOf(asyncAllResult).toEqualTypeOf<
				AsyncResult<[string, number, string], Error | CustomError>
			>();

			expect(asyncAllResult).toBeInstanceOf(AsyncResult);
			const result = await asyncAllResult;

			Result.assertError(result);
			expect(result.error).toBeInstanceOf(CustomError);
			expect(functionThatReturnsString).not.toHaveBeenCalled();
		});

		it("catches async failures correctly", async () => {
			const asyncAllResult = Result.allCatching(
				"a",
				async (): Promise<number> => {
					throw new CustomError();
				},
			);

			expectTypeOf(asyncAllResult).toEqualTypeOf<
				AsyncResult<[string, number], Error>
			>();

			expect(asyncAllResult).toBeInstanceOf(AsyncResult);

			const result = await asyncAllResult;
			Result.assertError(result);
			expect(result.error).toBeInstanceOf(CustomError);
		});

		it("does not track any thrown error when not needed", () => {
			const result = Result.allCatching(Result.ok("a"));
			expectTypeOf(result).toEqualTypeOf<Result<[string], never>>();
		});

		it("handles generators correctly", () => {
			const result = Result.allCatching("a", function* () {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;
				const b = yield* Result.ok(2) as Result<number, ErrorB>;
				return a + b;
			});

			expectTypeOf(result).toEqualTypeOf<
				Result<[string, number], Error | ErrorA | ErrorB>
			>();
			Result.assertOk(result);
			expect(result.value).toEqual(["a", 3]);
		});

		it("handles async generators correctly", async () => {
			const asyncResult = Result.allCatching("a", async function* () {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;
				const b = yield* Result.ok(2) as Result<number, ErrorB>;
				return a + b;
			});

			expectTypeOf(asyncResult).toEqualTypeOf<
				AsyncResult<[string, number], Error | ErrorA | ErrorB>
			>();
			const result = await asyncResult;
			Result.assertOk(result);
			expect(result.value).toEqual(["a", 3]);
		});

		it("handles generators correctly that return a async-result", async () => {
			const asyncResult = Result.allCatching("a", function* () {
				return AsyncResult.ok(3);
			});

			expect(asyncResult).toBeInstanceOf(AsyncResult);
			expectTypeOf(asyncResult).toEqualTypeOf<
				AsyncResult<[string, number], Error>
			>();
			const result = await asyncResult;
			Result.assertOk(result);
			expect(result.value).toEqual(["a", 3]);
		});
	});

	describe("Result.all", () => {
		it("combines both sync and async values into one result, just like Result.allCatching", async () => {
			const asyncAllResult = Result.all(
				"a",
				Promise.resolve("b"),
				Result.ok("c"),
				Result.try(async () => "d"),
				() => "e",
				() => Result.try(async () => "f"),
				() => Result.ok("g"),
				async () => "h",
				function* () {
					const i = yield* Result.ok("i");

					return Result.ok(i);
				},
				function* () {
					return AsyncResult.ok("j");
				},
				async function* () {
					return AsyncResult.ok("k");
				},
			);

			expectTypeOf(asyncAllResult).toEqualTypeOf<
				AsyncResult<
					[
						string,
						string,
						string,
						string,
						string,
						string,
						string,
						string,
						string,
						string,
						string,
					],
					Error
				>
			>();

			expect(asyncAllResult).toBeInstanceOf(AsyncResult);
			const result = await asyncAllResult;
			Result.assertOk(result);
			expect(result.value).toEqual([
				"a",
				"b",
				"c",
				"d",
				"e",
				"f",
				"g",
				"h",
				"i",
				"j",
				"k",
			]);
		});

		it("does not track async exceptions but throws them instead", async () => {
			await expect(() =>
				Result.all("a", async (): Promise<number> => {
					throw new CustomError();
				}),
			).rejects.toBeInstanceOf(CustomError);
		});

		it("does not track sync exceptions but throws them instead", async () => {
			expect(() =>
				Result.all("a", (): number => {
					throw new CustomError();
				}),
			).to.throw(CustomError);
		});
	});

	describe("Result.fromAsync", () => {
		it("transforms a promise holding a regular value into an async result", async () => {
			const asyncResult = Result.fromAsync(Promise.resolve(12));

			expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<number, never>>();
			expect(asyncResult).toBeInstanceOf(AsyncResult);
			const resolvedAsyncResult = await asyncResult;
			Result.assertOk(resolvedAsyncResult);
			expect(resolvedAsyncResult.value).toBe(12);
		});

		it("transforms a promise holding a Result into an async result", async () => {
			const asyncResult = Result.fromAsync(Promise.resolve(Result.ok(12)));

			expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<number, never>>();
			expect(asyncResult).toBeInstanceOf(AsyncResult);
			const resolvedAsyncResult = await asyncResult;
			Result.assertOk(resolvedAsyncResult);
			expect(resolvedAsyncResult.value).toBe(12);
		});

		it("transforms a promise holding a AsyncResult into an async result", async () => {
			const asyncResult = Result.fromAsync(Promise.resolve(AsyncResult.ok(12)));

			expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<number, never>>();
			expect(asyncResult).toBeInstanceOf(AsyncResult);
			const resolvedAsyncResult = await asyncResult;
			Result.assertOk(resolvedAsyncResult);
			expect(resolvedAsyncResult.value).toBe(12);
		});

		it("does not track async exceptions but throws them instead", async () => {
			await expect(() =>
				Result.fromAsync(
					Promise.resolve().then(() => {
						throw new CustomError();
					}),
				),
			).rejects.toBeInstanceOf(CustomError);
		});

		it("throws when exceptions are encountered in the async function returning the promise", async () => {
			async function myFunction(): Promise<Result<number, ErrorB>> {
				throw new CustomError("Boom!");
			}

			await expect(() =>
				Result.fromAsync(myFunction()).map(() => 12),
			).rejects.toThrow(CustomError);
		});

		it("takes an async function and turns it into an async-result", async () => {
			const result = Result.fromAsync(async () => {
				await sleep();
				return Result.ok(12);
			});

			expect(result).toBeInstanceOf(AsyncResult);
			expectTypeOf(result).toEqualTypeOf<AsyncResult<number, never>>();
			expect(await result).toEqual(Result.ok(12));
		});

		it("takes an async function that possibly returns multiple types", async () => {
			const exec = (value: number) =>
				Result.fromAsync(async () => {
					if (value === 1) {
						return "one" as const;
					}

					if (value === 2) {
						return Result.ok("two" as const);
					}

					if (value === 3) {
						return AsyncResult.ok("three" as const);
					}

					if (value === 4) {
						return Promise.resolve("four" as const);
					}

					if (value === 5) {
						return Result.error(new ErrorA("five"));
					}

					return Promise.resolve(Result.error(new ErrorB()));
				});

			expectTypeOf(exec).returns.toEqualTypeOf<
				AsyncResult<"one" | "two" | "three" | "four", ErrorA | ErrorB>
			>();

			expect(await exec(1)).toEqual(Result.ok("one"));
			expect(await exec(2)).toEqual(Result.ok("two"));
			expect(await exec(3)).toEqual(Result.ok("three"));
			expect(await exec(4)).toEqual(Result.ok("four"));
			expect(await exec(5)).toEqual(Result.error(new ErrorA("five")));
			expect(await exec(6)).toEqual(Result.error(new ErrorB()));
		});
	});

	describe("Result.fromAsyncCatching", () => {
		it("transforms a promise holding a regular value into an async result", async () => {
			const asyncResult = Result.fromAsyncCatching(Promise.resolve(12));

			expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<number, Error>>();
			expect(asyncResult).toBeInstanceOf(AsyncResult);
			const resolvedAsyncResult = await asyncResult;
			Result.assertOk(resolvedAsyncResult);
			expect(resolvedAsyncResult.value).toBe(12);
		});

		it("catches any errors that might occur inside the promise and returns it as a failure", async () => {
			const asyncResult = Result.fromAsyncCatching(
				Promise.resolve(12).then((): number => {
					throw new CustomError();
				}),
			);

			expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<number, Error>>();
			expect(asyncResult).toBeInstanceOf(AsyncResult);
			const resolvedAsyncResult = await asyncResult;
			Result.assertError(resolvedAsyncResult);
			expect(resolvedAsyncResult.error).toBeInstanceOf(CustomError);
		});

		it("takes an async function that possibly returns multiple types", async () => {
			const exec = (value: number) =>
				Result.fromAsyncCatching(async () => {
					if (value === 1) {
						return "one" as const;
					}

					if (value === 2) {
						return Result.ok("two" as const);
					}

					if (value === 3) {
						return AsyncResult.ok("three" as const);
					}

					if (value === 4) {
						return Promise.resolve("four" as const);
					}

					if (value === 5) {
						return Result.error(new ErrorA("five"));
					}

					return Promise.resolve(Result.error(new ErrorB()));
				});

			expectTypeOf(exec).returns.toEqualTypeOf<
				AsyncResult<"one" | "two" | "three" | "four", ErrorA | ErrorB | Error>
			>();

			expect(await exec(1)).toEqual(Result.ok("one"));
			expect(await exec(2)).toEqual(Result.ok("two"));
			expect(await exec(3)).toEqual(Result.ok("three"));
			expect(await exec(4)).toEqual(Result.ok("four"));
			expect(await exec(5)).toEqual(Result.error(new ErrorA("five")));
			expect(await exec(6)).toEqual(Result.error(new ErrorB()));
		});

		it("catches thrown exceptions inside the callback correctly", async () => {
			const asyncResult = Result.fromAsyncCatching(async () => {
				throw new CustomError("Boom!");
			});

			expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<never, Error>>();
			expect(asyncResult).toBeInstanceOf(AsyncResult);

			const result = await asyncResult;
			Result.assertError(result);
			expect(result.error).toBeInstanceOf(CustomError);
		});

		it("allows you to transform the error that was thrown inside the callback into a new error", async () => {
			const asyncResult = Result.fromAsyncCatching(
				async (): Promise<number> => {
					throw new CustomError("Boom!");
				},
				(error) => {
					expect(error).toBeInstanceOf(CustomError);
					return new ErrorA("my message", { cause: error });
				},
			);

			expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<number, ErrorA>>();

			const result = await asyncResult;

			Result.assertError(result);

			expect(result.error).toBeInstanceOf(ErrorA);
		});

		it("throws when exceptions are encountered in the transform function", async () => {
			await expect(() =>
				Result.fromAsyncCatching(
					async (): Promise<number> => {
						throw new CustomError();
					},
					(error) => {
						throw error;
					},
				),
			).rejects.toThrow(CustomError);
		});
	});

	describe("Result.gen", () => {
		it("handles a sync generator function correctly", () => {
			const result = Result.gen(function* () {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;
				const b = yield* Result.ok(2) as Result<number, ErrorB>;

				return a + b;
			});

			expectTypeOf(result).toEqualTypeOf<Result<number, ErrorA | ErrorB>>();
			expect(result).toEqual(Result.ok(3));
		});

		it("handles a sync generator function that yields an error correctly", () => {
			const result = Result.gen(function* () {
				const a = yield* Result.error(new ErrorA()) as Result<number, ErrorA>;

				throw new Error("This should not be reached");

				// biome-ignore lint/correctness/noUnreachable: for testing
				const b = yield* Result.ok(2) as Result<number, ErrorB>;

				return a + b;
			});

			expectTypeOf(result).toEqualTypeOf<Result<number, ErrorA | ErrorB>>();
			expect(result).toEqual(Result.error(new ErrorA()));
		});

		it("handles an async generator function correctly", async () => {
			const asyncResult = Result.gen(function* () {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;
				const b = yield* AsyncResult.ok(2) as AsyncResult<number, ErrorB>;
				const c = yield* Result.ok(3) as Result<number, ErrorB>;

				return a + b + c;
			});

			expectTypeOf(asyncResult).toEqualTypeOf<
				AsyncResult<number, ErrorA | ErrorB>
			>();
			expect(asyncResult).toBeInstanceOf(AsyncResult);
			const result = await asyncResult;
			expect(result).toEqual(Result.ok(6));
		}, 1000);

		it("handles an async generator function that yields an error correctly", async () => {
			const asyncResult = Result.gen(function* () {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;
				const b = yield* AsyncResult.fromPromise(
					Promise.resolve(Result.error(new ErrorB())),
				) as AsyncResult<number, ErrorB>;

				throw new Error("This should not be reached");

				// biome-ignore lint/correctness/noUnreachable: for testing
				const c = yield* Result.ok(3) as Result<number, ErrorB>;

				return a + b + c;
			});

			expectTypeOf(asyncResult).toEqualTypeOf<
				AsyncResult<number, ErrorA | ErrorB>
			>();
			expect(asyncResult).toBeInstanceOf(AsyncResult);
			const result = await asyncResult;
			expect(result).toEqual(Result.error(new ErrorB()));
		}, 1000);

		it("supports nested sync generator functions", () => {
			function* syncFn() {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;
				const b = yield* Result.ok(2) as Result<number, ErrorB>;
				return a + b;
			}

			const nestedSync = Result.gen(function* () {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;
				const b = yield* syncFn();

				return a + b;
			});

			expectTypeOf(nestedSync).toEqualTypeOf<Result<number, ErrorA | ErrorB>>();
			expect(nestedSync).toEqual(Result.ok(4));
		});

		it("supports nested async generator functions", async () => {
			async function* asyncFn() {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;
				const b = yield* AsyncResult.ok(2) as AsyncResult<number, ErrorB>;

				return a + b;
			}

			const nestedAsync = Result.gen(async function* () {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;
				const b = yield* asyncFn();

				return a + b;
			});

			expectTypeOf(nestedAsync).toEqualTypeOf<
				AsyncResult<number, ErrorA | ErrorB>
			>();

			expect(nestedAsync).toBeInstanceOf(AsyncResult);
			const result = await nestedAsync;
			expect(result).toEqual(Result.ok(4));
		});

		it("supports generator functions that return a literal value", async () => {
			const asyncResult = Result.gen(async function* () {
				return 12;
			});

			expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<number, never>>();
			expect(asyncResult).toBeInstanceOf(AsyncResult);
			expect(await asyncResult).toEqual(Result.ok(12));
		});

		it("supports sync generator functions that return a result", () => {
			const result = Result.gen(function* () {
				return Result.ok(12);
			});

			expectTypeOf(result).toEqualTypeOf<Result<number, never>>();
			expect(result).toBeInstanceOf(Result);
			expect(result).toEqual(Result.ok(12));
		});

		it("supports async generator functions that return a result", async () => {
			const asyncResult = Result.gen(async function* () {
				return Result.ok(12) as Result<number, ErrorA>;
			});

			expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<number, ErrorA>>();
			expect(asyncResult).toBeInstanceOf(AsyncResult);
			expect(await asyncResult).toEqual(Result.ok(12));
		});

		it("correctly detects when an async result is returned", () => {
			const result = Result.gen(function* () {
				return AsyncResult.ok(12) as AsyncResult<number, ErrorA>;
			});

			expectTypeOf(result).toEqualTypeOf<AsyncResult<number, ErrorA>>();
		});

		it("does not track thrown expections", () => {
			expect(() =>
				Result.gen(function* () {
					throw new CustomError("Boom!");
				}),
			).to.throw(CustomError);
		});

		it("does not track thrown expections in async generator functions", async () => {
			await expect(() =>
				Result.gen(async function* () {
					throw new CustomError("Boom!");
				}),
			).rejects.toThrow(CustomError);
		});

		it("mixed", async () => {
			function* someOtherFunc() {
				yield 5; // this should be simply ignored
				return 4;
			}

			function* someFunc() {
				const a = yield* someOtherFunc();
				return a;
			}

			const asyncResult = Result.gen(function* () {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;
				const b = yield* AsyncResult.ok(2) as AsyncResult<number, ErrorB>;
				const c = yield* Result.ok(3) as Result<number, ErrorB>;
				const d = yield* someFunc();

				return a + b + c + d;
			});

			expectTypeOf(asyncResult).toEqualTypeOf<
				AsyncResult<number, ErrorA | ErrorB>
			>();

			const result = await asyncResult;
			expect(result).toEqual(Result.ok(10));
		});

		it("allows to to pass the 'this' context", () => {
			class MyClass {
				constructor(public someValue: number) {}

				methodA() {
					return Result.gen(this, function* () {
						return this.someValue;
					});
				}
			}

			const result = new MyClass(42).methodA();
			expectTypeOf(result).toEqualTypeOf<Result<number, never>>();
			Result.assertOk(result);
			expect(result.value).toBe(42);
		});

		it("allows you to pass a generator directly", () => {
			function* generatorFunction(value: number) {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;

				return a + value;
			}

			const result = Result.gen(generatorFunction(2));

			expectTypeOf(result).toEqualTypeOf<Result<number, ErrorA>>();
			Result.assertOk(result);
			expect(result.value).toBe(3);
		});

		it("allows you to pass a generator directly that throws", () => {
			function* generatorFunction(value: number) {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;

				throw new Error("boom");

				// biome-ignore lint/correctness/noUnreachable: for testing
				return a + value;
			}

			expect(() => Result.gen(generatorFunction(2))).toThrow(new Error("boom"));
		});
	});

	describe("Result.genCatching", () => {
		it("returns a successful result from a generator function", () => {
			const result = Result.genCatching(
				function* () {
					const a = yield* Result.ok(1) as Result<number, ErrorA>;
					const b = yield* Result.ok(2) as Result<number, ErrorB>;

					return a + b;
				},
				() => new CustomError("Custom error"),
			);

			expectTypeOf(result).toEqualTypeOf<
				Result<number, CustomError | ErrorA | ErrorB>
			>();
			Result.assertOk(result);
			expect(result.value).toBe(3);
		});

		it("tracks thrown exceptions in a generator function and transforms them using the provided callback function", () => {
			const result = Result.genCatching(
				function* () {
					const a = yield* Result.ok(1) as Result<number, ErrorA>;
					const b = yield* Result.ok(2) as Result<number, ErrorB>;

					throw new Error("Boom!");

					// biome-ignore lint/correctness/noUnreachable: for testing
					return a + b;
				},
				() => new CustomError("Custom error"),
			);

			expectTypeOf(result).toEqualTypeOf<
				Result<number, ErrorA | ErrorB | Error>
			>();
			Result.assertError(result);
			expect(result.error).toEqual(new CustomError("Custom error"));
		});

		it("tracks thrown exceptions in a generator function and encapsulates them in a failed result", () => {
			const result = Result.genCatching(function* () {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;
				const b = yield* Result.ok(2) as Result<number, ErrorB>;

				throw new Error("Boom!");

				// biome-ignore lint/correctness/noUnreachable: for testing
				return a + b;
			});

			expectTypeOf(result).toEqualTypeOf<
				Result<number, ErrorA | ErrorB | Error>
			>();
			Result.assertError(result);
			expect(result.error).toEqual(new Error("Boom!"));
		});

		it("tracks thrown exceptions in a generator function (with async-result) and returns them as an error", async () => {
			const asyncResult = Result.genCatching(
				function* () {
					const a = yield* Result.ok(1) as Result<number, ErrorA>;
					const b = yield* AsyncResult.ok(2) as AsyncResult<number, ErrorB>;

					throw new Error("Boom!");

					// biome-ignore lint/correctness/noUnreachable: for testing
					return a + b;
				},
				() => new CustomError("Custom error"),
			);

			expectTypeOf(asyncResult).toEqualTypeOf<
				AsyncResult<number, ErrorA | ErrorB | Error>
			>();
			const result = await asyncResult;
			Result.assertError(result);
			expect(result.error).toEqual(new CustomError("Custom error"));
		});

		it("tracks thrown exceptions in an async generator function and transforms them using the provided callback fn", async () => {
			const asyncResult = Result.genCatching(
				async function* () {
					const a = yield* Result.ok(1) as Result<number, ErrorA>;
					const b = yield* Result.ok(2) as Result<number, ErrorB>;

					throw new Error("Boom!");

					// biome-ignore lint/correctness/noUnreachable: for testing
					return a + b;
				},
				() => new CustomError("Custom error"),
			);

			expectTypeOf(asyncResult).toEqualTypeOf<
				AsyncResult<number, ErrorA | ErrorB | Error>
			>();
			const result = await asyncResult;
			Result.assertError(result);
			expect(result.error).toEqual(new CustomError("Custom error"));
		});

		it("tracks thrown exceptions in an async generator function and encapsulates them in a failed result", async () => {
			const asyncResult = Result.genCatching(async function* () {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;
				const b = yield* Result.ok(2) as Result<number, ErrorB>;

				throw new Error("Boom!");

				// biome-ignore lint/correctness/noUnreachable: for testing
				return a + b;
			});

			expectTypeOf(asyncResult).toEqualTypeOf<
				AsyncResult<number, ErrorA | ErrorB | Error>
			>();
			const result = await asyncResult;
			Result.assertError(result);
			expect(result.error).toEqual(new Error("Boom!"));
		});

		it("allows to to pass the 'this' context", () => {
			class MyClass {
				constructor(public someValue: number) {}

				methodA() {
					return Result.genCatching(this, function* () {
						return this.someValue;
					});
				}
			}

			const result = new MyClass(42).methodA();
			expectTypeOf(result).toEqualTypeOf<Result<number, Error>>();
			Result.assertOk(result);
			expect(result.value).toBe(42);
		});

		it("allows you to pass a generator directly", () => {
			function* generatorFunction(value: number) {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;

				return a + value;
			}

			const result = Result.genCatching(generatorFunction(2));

			expectTypeOf(result).toEqualTypeOf<Result<number, ErrorA | Error>>();
			Result.assertOk(result);
			expect(result.value).toBe(3);
		});

		it("allows you to pass a generator directly that throws", () => {
			function* generatorFunction(value: number) {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;

				throw new Error("boom");

				// biome-ignore lint/correctness/noUnreachable: for testing
				return a + value;
			}

			const result = Result.genCatching(generatorFunction(2));
			Result.assertError(result);
			expect(result.error).toEqual(new Error("boom"));
		});

		it("allows you to pass a generator directly that throws and transform the error using a callback", () => {
			function* generatorFunction(value: number) {
				const a = yield* Result.ok(1) as Result<number, ErrorA>;

				throw new Error("boom");

				// biome-ignore lint/correctness/noUnreachable: for testing
				return a + value;
			}

			const result = Result.genCatching(
				generatorFunction(2),
				(error) => new ErrorB("Transformed error", { cause: error }),
			);
			Result.assertError(result);

			expect(result.error).toEqual(
				new ErrorB("Transformed error", { cause: new Error("boom") }),
			);
		});
	});

	describe("Misc type checks", () => {
		it("unions between multiple result types", () => {
			const result = Result.ok(12) as
				| Result<never, ErrorA>
				| Result<never, ErrorB>
				| Result<number, never>;

			expectTypeOf(result.error).toEqualTypeOf<ErrorA | ErrorB | undefined>();
			expectTypeOf(result.value).toEqualTypeOf<number | undefined>();

			if (result.isOk()) {
				expectTypeOf(result.value).toEqualTypeOf<number>();
			}
			if (result.isError()) {
				expectTypeOf(result.error).toEqualTypeOf<ErrorA | ErrorB>();
			}

			expectTypeOf(result.errorOrNull()).toEqualTypeOf<
				ErrorA | ErrorB | null
			>();

			expectTypeOf(result.getOrNull()).toEqualTypeOf<number | null>();

			expectTypeOf(result.getOrDefault("aaa")).toEqualTypeOf<number | string>();

			expectTypeOf(
				result.getOrElse((error) => {
					expectTypeOf(error).toEqualTypeOf<ErrorA | ErrorB>();
					return 2;
				}),
			).toEqualTypeOf<number>();

			expectTypeOf(result.getOrThrow()).toEqualTypeOf<number>();

			expectTypeOf(
				result.fold(
					(value) => {
						expectTypeOf(value).toEqualTypeOf<number>();
						return 1;
					},
					(error) => {
						expectTypeOf(error).toEqualTypeOf<ErrorA | ErrorB>();
						return 2;
					},
				),
			).toEqualTypeOf<number>();

			expectTypeOf(
				result.onFailure((error) => {
					expectTypeOf(error).toEqualTypeOf<ErrorA | ErrorB>();
					return 2;
				}),
			).toMatchTypeOf<Result<number, ErrorA | ErrorB>>();

			expectTypeOf(
				result.onSuccess((value) => {
					expectTypeOf(value).toEqualTypeOf<number>();
					return 2;
				}),
			).toMatchTypeOf<Result<number, ErrorA | ErrorB>>();

			expectTypeOf(result.map((value) => value * 2)).toMatchTypeOf<
				Result<number, ErrorA | ErrorB>
			>();

			expectTypeOf(result.mapCatching((value) => value * 2)).toMatchTypeOf<
				Result<number, ErrorA | ErrorB | Error>
			>();

			expectTypeOf(
				result.recover((error) => {
					expectTypeOf(error).toEqualTypeOf<ErrorA | ErrorB>();
					return 2;
				}),
			).toEqualTypeOf<Result<number, never>>();

			expectTypeOf(
				result.recoverCatching((error) => {
					expectTypeOf(error).toEqualTypeOf<ErrorA | ErrorB>();
					return 2;
				}),
			).toEqualTypeOf<Result<number, Error>>();
		});
	});

	it("correctly narrows the type of the result when using isOk/isError", () => {
		const resultA = Result.ok(12) as Result<number, ErrorA>;
		const resultB = Result.ok(12) as Result<number, ErrorB>;

		if (resultA.isOk()) {
			expectTypeOf(resultA).toEqualTypeOf<Result.Ok<number>>;
			expectTypeOf(resultA.value).toBeNumber();
			expectTypeOf(resultA.error).toBeUndefined();
		} else {
			expectTypeOf(resultA).toEqualTypeOf<Result.Error<ErrorA>>();
			expectTypeOf(resultA.value).toBeUndefined();
			expectTypeOf(resultA.error).toEqualTypeOf<ErrorA>();
		}

		if (resultB.isError()) {
			expectTypeOf(resultB).toEqualTypeOf<Result.Error<ErrorB>>();
			expectTypeOf(resultB.value).toBeUndefined();
			expectTypeOf(resultB.error).toEqualTypeOf<ErrorB>();
			return;
		}

		expectTypeOf(resultB).toEqualTypeOf<Result.Ok<number>>();
		expectTypeOf(resultB.value).toBeNumber();
		expectTypeOf(resultB.error).toBeUndefined();
	});

	it("should disregard any mapped values after a result can only be a failure", () => {
		const syncFailure = Result.error(new ErrorA());
		const asyncFailure = AsyncResult.error(new ErrorA());

		const resultA = syncFailure.map((value) => {
			expectTypeOf(value).toEqualTypeOf<never>();
			return Result.ok(12);
		});
		expectTypeOf(resultA).toEqualTypeOf<Result.Error<ErrorA>>();

		const resultB = syncFailure.map(async () => Result.ok(12));
		// It should disregard the async mapping as well
		expectTypeOf(resultB).toEqualTypeOf<Result.Error<ErrorA>>();

		const resultC = syncFailure.mapCatching(() => Result.ok(12));
		expectTypeOf(resultC).toEqualTypeOf<Result.Error<ErrorA>>();

		const resultD = asyncFailure.map((value) => {
			expectTypeOf(value).toEqualTypeOf<never>();
			return Result.ok(12);
		});
		expectTypeOf(resultD).toEqualTypeOf<AsyncResult<never, ErrorA>>();

		const resultE = asyncFailure.mapCatching((value) => {
			expectTypeOf(value).toEqualTypeOf<never>();
			return Result.ok(12);
		});
		expectTypeOf(resultE).toEqualTypeOf<AsyncResult<never, ErrorA>>();
	});

	it("should disregard any recovered errors after a result can only be a success", () => {
		const syncSuccess = Result.ok(12);
		const asyncSuccess = AsyncResult.ok(12);

		const resultA = syncSuccess.recover(() => Result.error(new ErrorA()));
		expectTypeOf(resultA).toEqualTypeOf<Result.Ok<number>>();

		const resultB = syncSuccess.recover(async (err) => {
			expectTypeOf(err).toEqualTypeOf<never>();
			Result.error(new ErrorA());
		});
		expectTypeOf(resultB).toEqualTypeOf<Result.Ok<number>>();

		const resultC = syncSuccess.recoverCatching(() =>
			Result.error(new ErrorA()),
		);
		expectTypeOf(resultC).toEqualTypeOf<Result.Ok<number>>();

		const resultD = asyncSuccess.recover(() => Result.error(new ErrorA()));
		expectTypeOf(resultD).toEqualTypeOf<AsyncResult<number, never>>();

		const resultE = asyncSuccess.recoverCatching((err) => {
			expectTypeOf(err).toEqualTypeOf<never>();
			return Result.error(new ErrorA());
		});

		expectTypeOf(resultE).toEqualTypeOf<AsyncResult<number, never>>();
	});

	it("Correctly infers the ok-value when there's some overlap with an Result instance", () => {
		// See: https://github.com/everweij/typescript-result/issues/19

		// { value: string } has some overlap with the Result type, so it seems like
		// TS is very strict with `ReturningValue<T>` and returns never. The workaround seem
		// to be to give `ExtractValue<T>` a fallback of `T`.
		const resultA = Result.ok(12).map(() => ({ value: "bar" }));

		expectTypeOf(resultA).toEqualTypeOf<Result.Ok<{ value: string }>>();

		const resultB = Result.try(() => ({ data: { value: "string" } })).map(
			({ data }) => data,
		);

		expectTypeOf(resultB).toEqualTypeOf<Result<{ value: string }, Error>>();
	});
});
