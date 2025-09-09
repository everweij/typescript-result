import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { AsyncResult, NonExhaustiveError, Result } from "./index.js";
import type { RedundantElseClauseError } from "./matcher.js";

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
			const asyncResult = Result.gen(function* () {
				return Result.ok(12);
			});

			expectTypeOf(asyncResult).toEqualTypeOf<Result<number, never>>();
			expect(asyncResult).toBeInstanceOf(Result);
			expect(asyncResult).toEqual(Result.ok(12));
		});

		it("supports async generator functions that returns a result", async () => {
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

	describe("instance methods and getters", () => {
		describe("$inferValue / $inferError", () => {
			it("infers the value and error type of a result", () => {
				const result = Result.ok(42) as Result<number, ErrorA>;

				expectTypeOf(result.$inferValue).toEqualTypeOf<number>();
				expectTypeOf(result.$inferError).toEqualTypeOf<ErrorA>();
			});
		});

		describe("value", () => {
			it("returns the encapsulated value on success", () => {
				const result = Result.ok(42) as Result<number, ErrorA>;
				expectTypeOf(result.value).toEqualTypeOf<number | undefined>();
				expect(result.value).toBe(42);
			});

			it("is aware whether there is a possible error or not", () => {
				const result = Result.ok(42);
				expectTypeOf(result).toEqualTypeOf<Result.Ok<number>>();
				// since the error type is 'never', in this case, the value can only be a number
				expectTypeOf(result.value).toEqualTypeOf<number>();
			});

			it("is aware whether there is a possible value or not", () => {
				const result = Result.error(errorA);
				expectTypeOf(result).toEqualTypeOf<Result.Error<ErrorA>>();
				// since the value type is 'never', in this case, the value can only be undefined
				expectTypeOf(result.value).toEqualTypeOf<undefined>();
			});

			it("also works when the result is a union of multiple results", () => {
				const result = Result.ok(42) as
					| Result<never, ErrorA>
					| Result<number, never>;

				expectTypeOf(result.value).toEqualTypeOf<number | undefined>();
			});
		});

		describe("error", () => {
			it("returns the encapsulated error on failure", () => {
				const result = Result.error(errorA) as Result<number, ErrorA>;
				expectTypeOf(result.error).toEqualTypeOf<ErrorA | undefined>();
				expect(result.error).toEqual(errorA);
			});

			it("is aware whether there is a possible value or not", () => {
				const result = Result.error(errorA);
				expectTypeOf(result).toEqualTypeOf<Result.Error<ErrorA>>();
				// since the value type is 'never', in this case, the error can only be of type 'ErrorA'
				expectTypeOf(result.error).toEqualTypeOf<ErrorA>();
			});

			it("is aware whether there is a possible error or not", () => {
				const result = Result.ok(42);
				expectTypeOf(result).toEqualTypeOf<Result.Ok<number>>();
				// since the error type is 'never', in this case, the error can only be undefined
				expectTypeOf(result.error).toEqualTypeOf<undefined>();
			});

			it("also works when the result is a union of multiple results", () => {
				const result = Result.ok(42) as
					| Result<never, ErrorA>
					| Result<number, never>;

				expectTypeOf(result.error).toEqualTypeOf<ErrorA | undefined>();
			});
		});

		describe("isOk", () => {
			it("returns true if the result is ok", () => {
				const result = Result.ok(42) as Result<number, ErrorA>;
				expect(result.isOk()).toBe(true);

				if (result.isOk()) {
					expectTypeOf(result).toEqualTypeOf<Result.Ok<number>>();
				}
			});

			it("returns false if the result is a failure", () => {
				const result: Result<number, ErrorA> = Result.error(errorA);
				expect(result.isOk()).toBe(false);
			});

			it("also works when the result is a union of multiple results", () => {
				const result = Result.ok(42) as
					| Result<never, ErrorA>
					| Result<number, never>;

				if (result.isOk()) {
					expectTypeOf(result).toEqualTypeOf<Result<number, never>>();
				}
			});
		});

		describe("isFailure", () => {
			it("returns true if the result is a failure", () => {
				const result: Result<number, ErrorA> = Result.error(errorA);
				expect(result.isError()).toBe(true);

				if (result.isError()) {
					expectTypeOf(result).toEqualTypeOf<Result.Error<ErrorA>>();
				}
			});

			it("returns false if the result is ok", () => {
				const result: Result<number, ErrorA> = Result.ok(42);
				expect(result.isError()).toBe(false);
			});

			it("also works when the result is a union of multiple results", () => {
				const result = Result.ok(42) as
					| Result<never, ErrorA>
					| Result<number, never>;

				if (result.isError()) {
					expectTypeOf(result).toEqualTypeOf<Result.Error<ErrorA>>();
				}
			});
		});

		describe("toTuple", () => {
			it("returns a tuple on a successful result", () => {
				const result = Result.ok(2) as Result<number, ErrorA>;

				const [value, error] = result.toTuple();
				expectTypeOf(value).toEqualTypeOf<number | null>();
				expectTypeOf(error).toEqualTypeOf<ErrorA | null>();
				if (error) {
					expectTypeOf(error).toEqualTypeOf<ErrorA>();
				} else {
					expectTypeOf(value).toEqualTypeOf<number>();
				}

				expect(value).toBe(2);
				expect(error).toBeNull();
			});

			it("returns a tuple on a failed result", () => {
				const result = Result.error(errorA) as Result<number, ErrorA>;

				const [value, error] = result.toTuple();
				if (error) {
					expectTypeOf(error).toEqualTypeOf<ErrorA>();
				} else {
					expectTypeOf(value).toEqualTypeOf<number>();
				}

				expect(value).toBeNull();
				expect(error).toBe(errorA);
			});

			it("handles cases where the result can only be successful", () => {
				const result = Result.ok(12);

				const [value, error] = result.toTuple();
				expectTypeOf(value).toEqualTypeOf<number>();
				expectTypeOf(error).toEqualTypeOf<never>();
				expect(value).toBe(12);
				expect(error).toBe(null);
			});

			it("handles cases where the result can only be a failure", () => {
				const result = Result.error(errorA);

				const [value, error] = result.toTuple();
				expectTypeOf(value).toEqualTypeOf<never>();
				expectTypeOf(error).toEqualTypeOf<ErrorA>();
				expect(value).toBe(null);
				expect(error).toBe(errorA);
			});
		});

		describe("errorOrNull", () => {
			it("returns the error on failure", () => {
				const result = Result.error(new CustomError()) as Result<
					number,
					CustomError
				>;

				expectTypeOf(result.errorOrNull()).toEqualTypeOf<CustomError | null>();

				expect(result.errorOrNull()).toBeInstanceOf(CustomError);
			});

			it("returns null on success", () => {
				const result = Result.ok(2) as Result<number, CustomError>;

				// Note: TS is smart enough to know that in this case there will never be an error
				// because of the Result<number, never> type.
				expectTypeOf(result.errorOrNull()).toEqualTypeOf<CustomError | null>();

				expect(result.errorOrNull()).toBe(null);
			});

			it("is aware whether there is a possible value or not", () => {
				const failureResult = Result.error(new CustomError());
				expectTypeOf(failureResult).toEqualTypeOf<Result.Error<CustomError>>();
				// since the value type is 'never', in this case, the error can only be of type 'CustomError'
				expectTypeOf(failureResult.errorOrNull()).toEqualTypeOf<CustomError>();

				const okResult = Result.ok(42);
				expectTypeOf(okResult).toEqualTypeOf<Result.Ok<number>>();
				// since the error type is 'never', in this case, the error can only be null
				expectTypeOf(okResult.errorOrNull()).toEqualTypeOf<null>();
			});
		});

		describe("getOrNull", () => {
			it("returns null on failure", () => {
				const result = Result.error(new CustomError()) as Result<
					number,
					CustomError
				>;

				expectTypeOf(result.getOrNull()).toEqualTypeOf<number | null>();

				expect(result.getOrNull()).toBe(null);
			});

			it("returns the encapsulated value on success", () => {
				const result = Result.ok(2) as Result<number, CustomError>;

				expectTypeOf(result.getOrNull()).toEqualTypeOf<number | null>();

				expect(result.getOrNull()).toBe(2);
			});

			it("is aware whether there is a possible error or not", () => {
				const okResult = Result.ok(42);
				expectTypeOf(okResult).toEqualTypeOf<Result.Ok<number>>();
				// since the error type is 'never', in this case, the error can only be a number
				expectTypeOf(okResult.getOrNull()).toEqualTypeOf<number>();

				const failureResult = Result.error(new CustomError());
				expectTypeOf(failureResult).toEqualTypeOf<Result.Error<CustomError>>();
				// since the value type is 'never', in this case, the value can only be a number
				expectTypeOf(failureResult.getOrNull()).toEqualTypeOf<null>();
			});
		});

		describe("toString", () => {
			it("returns a string friendly version of an encapsulated error with a message", () => {
				const result = Result.error(new CustomError("Cannot find item"));

				expect(result.toString()).toBe("Result.error(Error: Cannot find item)");
			});

			it("returns a string friendly version of an encapsulated primitive value", () => {
				const result = Result.ok(1);

				expect(result.toString()).toBe("Result.ok(1)");
			});
			it("returns a string friendly version of an encapsulated object value", () => {
				const result = Result.ok({ a: 12 });

				expect(result.toString()).toBe("Result.ok([object Object])");
			});
		});

		describe("getOrDefault", () => {
			it("returns the encapsulated value when the result is ok", () => {
				const result = Result.ok(2);

				const outcome = result.getOrDefault(4);

				expectTypeOf(outcome).toEqualTypeOf<number>();
				expect(outcome).toBe(2);
			});

			it("returns the provided default value when the result represents a failure", () => {
				const result = Result.error(new CustomError()) as Result<
					number,
					CustomError
				>;

				const outcome = result.getOrDefault(4);

				expectTypeOf(outcome).toEqualTypeOf<number>();
				expect(outcome).toBe(4);
			});
		});

		describe("getOrElse", () => {
			it("returns the encapsulated value when the result is ok", () => {
				const result = Result.ok(2);

				const elseFn = vi.fn().mockReturnValue(4) as () => number;

				expect(result.getOrElse(elseFn)).toBe(2);
				expect(elseFn).not.toHaveBeenCalled();
			});

			it("returns the result of the handler function for the encapsulated error type if it is a failure", () => {
				const result = Result.error(new CustomError()) as Result<
					number,
					CustomError
				>;

				const outcome = result.getOrElse((error) => {
					expectTypeOf(error).toEqualTypeOf<CustomError>();
					return 4;
				});

				expect(outcome).toBe(4);
			});

			it("returns a promise when the handler function is async", async () => {
				const result = Result.error(new CustomError()) as Result<
					number,
					CustomError
				>;

				const outcome = result.getOrElse(async () => {
					return 4;
				});

				expect(outcome).toBeInstanceOf(Promise);
				expect(await outcome).toBe(4);
			});

			it("returns a promise when the handler function is async even though the result is ok", async () => {
				const result = Result.ok(12) as Result<number, CustomError>;

				const outcome = result.getOrElse(async () => {
					return 4;
				});

				expect(outcome).toBeInstanceOf(Promise);
				expect(await outcome).toBe(12);
			});
		});

		describe("getOrThrow", () => {
			it("returns the encapsulated value when the result is ok", () => {
				const result = Result.ok(2);

				expectTypeOf(result.getOrThrow()).toEqualTypeOf<number>();
				expect(result.getOrThrow()).toBe(2);
			});

			it("throws the encapsulated error when the result represents a failure", () => {
				const result = Result.error(new CustomError());

				expect(() => result.getOrThrow()).toThrow(CustomError);
			});
		});

		describe("fold", () => {
			it("returns the result of the onSuccess-callback for the encapsulated value if this instance represents success", () => {
				const result = Result.ok(2) as Result<number, ErrorA>;

				const spy = vi.fn();

				const number = result.fold(
					(value) => {
						expectTypeOf(value).toEqualTypeOf<number>();
						return value * 2;
					},
					(error) => {
						expectTypeOf(error).toEqualTypeOf<ErrorA>();
						spy();
						return 123;
					},
				);

				expectTypeOf(number).toEqualTypeOf<number>();

				expect(number).toBe(4);
				expect(spy).not.toHaveBeenCalled();
			});

			it("returns the result of the onFailure-callback for the encapsulated error if it is a failure", () => {
				const result = Result.error("some failure") as Result<number, string>;

				const spy = vi.fn();

				const message = result.fold(
					(value) => {
						expectTypeOf(value).toEqualTypeOf<number>();

						spy();

						return "some value";
					},
					(error) => error.toUpperCase(),
				);

				expectTypeOf(message).toEqualTypeOf<string>();

				expect(message).toBe("SOME FAILURE");
				expect(spy).not.toHaveBeenCalled();
			});

			it("returns a promise when at least one of the handlers is async", async () => {
				const failureResult = Result.error(errorA) as Result<number, ErrorA>;
				const failureOutcome = failureResult.fold(
					async () => 12,
					() => 12,
				);
				expectTypeOf(failureOutcome).toEqualTypeOf<Promise<number>>();
				expect(failureOutcome).toBeInstanceOf(Promise);

				const okResult = Result.ok(12) as Result<number, ErrorA>;
				const successOutcome = okResult.fold(
					() => 12,
					async () => 12,
				);
				expectTypeOf(successOutcome).toEqualTypeOf<Promise<number>>();
				expect(successOutcome).toBeInstanceOf(Promise);
			});

			it("returns a promise when at least one of the handlers returns a promise", async () => {
				const failureResult = Result.error(errorA) as Result<number, ErrorA>;
				const failureOutcome = failureResult.fold(
					() => (Math.random() > 0.5 ? Promise.resolve(12) : 12),
					() => 12,
				);

				expectTypeOf(failureOutcome).toEqualTypeOf<Promise<number>>();
				const val = await failureOutcome;
				expect(val).toEqual(12);
			});
		});

		describe("onFailure", () => {
			it("allows you to execute a side-effect when dealing with a failure", () => {
				const result = Result.error(errorA);

				const spy = vi.fn();

				const outcome = result.onFailure((error) => {
					expectTypeOf(error).toEqualTypeOf<ErrorA>();
					spy();
				});

				expect(outcome).toBe(result);
				expect(spy).toHaveBeenCalled();
			});

			it("does not call the provided callback when dealing with a successful result", () => {
				const result = Result.ok(1);

				const callback = vi.fn();
				result.onFailure(callback);

				expect(callback).not.toHaveBeenCalled();
			});

			it("accepts an async callback as well", async () => {
				const result = Result.error(errorA) as Result<number, ErrorA>;

				const outcome = result.onFailure(async (error) => {
					expectTypeOf(error).toEqualTypeOf<ErrorA>();
				});

				expectTypeOf(outcome).toEqualTypeOf<AsyncResult<number, ErrorA>>();
				expect(outcome).toBeInstanceOf(AsyncResult);

				const resolvedOutcome = await outcome;
				Result.assertError(resolvedOutcome);
			});

			it("returns an async result when an async callback passed even though the result is ok", async () => {
				const result = Result.ok(12) as Result<number, ErrorA>;

				const outcome = result.onFailure(async (error) => {
					expectTypeOf(error).toEqualTypeOf<ErrorA>();
				});

				expectTypeOf(outcome).toEqualTypeOf<AsyncResult<number, ErrorA>>();
				expect(outcome).toBeInstanceOf(AsyncResult);

				const resolvedOutcome = await outcome;
				Result.assertOk(resolvedOutcome);
				expect(result.value).toBe(12);
			});
		});

		describe("onSuccess", () => {
			it("allows you to execute a side-effect when dealing with a successful result", () => {
				const result = Result.ok(12);

				const spy = vi.fn();

				const outcome = result.onSuccess((value) => {
					expectTypeOf(value).toEqualTypeOf<number>();
					spy();
				});

				expect(outcome).toBe(result);
				expect(spy).toHaveBeenCalled();
			});

			it("does not call the on-success handler when the result represents a failure", () => {
				const result = Result.error(new CustomError());

				const handler = vi.fn();
				result.onSuccess(handler);

				expect(handler).not.toHaveBeenCalled();
			});

			it("accepts an async callback as well", async () => {
				const result = Result.ok(12);

				const outcome = result.onSuccess(async (value) => {
					expectTypeOf(value).toEqualTypeOf<number>();
				});

				expectTypeOf(outcome).toEqualTypeOf<AsyncResult<number, never>>();
				expect(outcome).toBeInstanceOf(AsyncResult);

				const resolvedOutcome = await outcome;
				Result.assertOk(resolvedOutcome);
			});

			it("returns an async result when an async callback passed even though the result is a failure", async () => {
				const result = Result.error(new CustomError()) as Result<
					number,
					CustomError
				>;

				const outcome = result.onSuccess(async (value) => {
					expectTypeOf(value).toEqualTypeOf<number>();
				});

				expectTypeOf(outcome).toEqualTypeOf<AsyncResult<number, CustomError>>();
				expect(outcome).toBeInstanceOf(AsyncResult);

				const resolvedOutcome = await outcome;
				Result.assertError(resolvedOutcome);
			});
		});

		describe("map", () => {
			it("maps an encapsulated successful value to a next result using a transform function", () => {
				const result = Result.ok(2);
				const nextResult = result.map((value) => value * 2);
				expectTypeOf(nextResult).toEqualTypeOf<Result<number, never>>();
				Result.assertOk(nextResult);
				expect(nextResult.value).toBe(4);
				expect(result).not.toBe(nextResult);
			});

			it("maps an encapsulated successful value to an async-result using an async transform function", async () => {
				const result = Result.ok(2);
				const nextAsyncResult = result.map(async (value) => value * 2);
				expectTypeOf(nextAsyncResult).toEqualTypeOf<
					AsyncResult<number, never>
				>();
				expect(nextAsyncResult).toBeInstanceOf(AsyncResult);

				const nextResult = await nextAsyncResult;

				Result.assertOk(nextResult);
				expect(nextResult.value).toBe(4);
			});

			it("lets you map over an encapsulated failed value by simply ignoring the transform function and returning the failed result", () => {
				const result = Result.error(new CustomError()) as Result<
					number,
					CustomError
				>;
				const nextResult = result.map((value) => value * 2);

				expectTypeOf(nextResult).toEqualTypeOf<Result<number, CustomError>>();
				expect(result).toBe(nextResult);
				Result.assertError(nextResult);
				expect(nextResult.error).toBeInstanceOf(CustomError);
			});

			it("accounts for the async transform function even when it is a failed result", async () => {
				const result = Result.error(new CustomError()) as Result<
					number,
					CustomError
				>;
				const nextAsyncResult = result.map(async (value) => value * 2);

				expectTypeOf(nextAsyncResult).toEqualTypeOf<
					AsyncResult<number, CustomError>
				>();
				expect(nextAsyncResult).toBeInstanceOf(AsyncResult);

				const nextResult = await nextAsyncResult;
				Result.assertError(nextResult);
				expect(nextResult.error).toBeInstanceOf(CustomError);
			});

			it("flattens a returning result from the transformation", () => {
				const result = Result.ok(2);
				const nextResult = result.map((value) => Result.ok(value * 2));
				expectTypeOf(nextResult).toEqualTypeOf<Result<number, never>>();
				Result.assertOk(nextResult);
				expect(nextResult.value).toBe(4);
				expect(result).not.toBe(nextResult);
			});

			it("flattens a returning result from the async transformation", async () => {
				const result = Result.ok(2);
				const nextAsyncResult = result.map(async (value) =>
					Result.ok(value * 2),
				);
				expectTypeOf(nextAsyncResult).toEqualTypeOf<
					AsyncResult<number, never>
				>();

				const nextResult = await nextAsyncResult;

				Result.assertOk(nextResult);
				expect(nextResult.value).toBe(4);
				expect(result).not.toBe(nextResult);
			});

			it("flattens a returning async-result from the transformation", async () => {
				const result = Result.ok(2);
				const otherAsyncResult = Result.fromAsync(
					Promise.resolve("some value"),
				);

				const nextAsyncResult = result.map(() => otherAsyncResult);
				expectTypeOf(nextAsyncResult).toEqualTypeOf<
					AsyncResult<string, never>
				>();

				const nextResult = await nextAsyncResult;

				Result.assertOk(nextResult);
				expect(nextResult.value).toBe("some value");
				expect(result).not.toBe(nextResult);
			});

			it("does not track errors thrown inside the transformation function", () => {
				expect(() =>
					Result.ok(2).map((): number => {
						throw new CustomError();
					}),
				).to.throw(CustomError);
			});

			it("will convert a failure into an async-result when an async transform function was given", async () => {
				const result = Result.error(new CustomError()) as Result<
					number,
					CustomError
				>;

				const asyncResult = result.map(async (x) => x * 2);

				expectTypeOf(asyncResult).toEqualTypeOf<
					AsyncResult<number, CustomError>
				>();

				expect(asyncResult).toBeInstanceOf(AsyncResult);

				const resolvedAsyncResult = await asyncResult;
				Result.assertError(resolvedAsyncResult);
				expect(resolvedAsyncResult.error).toBeInstanceOf(CustomError);
			});

			it("merges a union of complex results into a single result", () => {
				const result = Result.ok(2) as
					| Result<number, ErrorA>
					| Result<never, ErrorB>;

				const nextResult = result.map((value) =>
					value === 2 ? Result.ok(value * 2) : Result.error(new CustomError()),
				);

				expectTypeOf(nextResult).toEqualTypeOf<
					Result<number, CustomError | ErrorA | ErrorB>
				>();

				expectTypeOf(nextResult).not.toEqualTypeOf<
					| Result<number, ErrorA>
					| Result<never, CustomError | ErrorA>
					| Result<number, ErrorB>
					| Result<never, CustomError | ErrorB>
				>();
			});

			it("resolves the correct type when the returned value is a union of result and async-result", async () => {
				const result = Result.ok(2) as Result<number, ErrorA>;

				const nextResult = result
					.map((value) =>
						value > 2
							? Result.error(new ErrorB())
							: Result.fromAsync(Promise.resolve("some value")),
					)
					.map((value) => {
						expectTypeOf(value).toEqualTypeOf<string>();

						return value.toUpperCase();
					});

				expectTypeOf(nextResult).toEqualTypeOf<
					AsyncResult<string, ErrorA | ErrorB>
				>();

				const outcome = await nextResult;
				Result.assertOk(outcome);
				expect(outcome.value).toBe("SOME VALUE");
			});

			it("resolves the correct type when the returned value is a union of result-like and regular values", async () => {
				function runSync(value: number) {
					return Result.ok(value).map((value) => {
						if (value === 1) {
							return "one";
						}

						if (value === 2) {
							return Result.ok("two" as const);
						}

						return Result.error(new ErrorB());
					});
				}

				expectTypeOf(runSync(1)).toEqualTypeOf<Result<"one" | "two", ErrorB>>();
				expect(runSync(1)).toEqual(Result.ok("one"));
				expect(runSync(2)).toEqual(Result.ok("two"));
				expect(runSync(3)).toEqual(Result.error(new ErrorB()));

				function runAsync(value: number) {
					return Result.ok(value).map(async (value) => {
						if (value === 1) {
							return "one";
						}

						if (value === 2) {
							return Result.ok("two" as const);
						}

						return Result.error(new ErrorB());
					});
				}

				expectTypeOf(runAsync(1)).toEqualTypeOf<
					AsyncResult<"one" | "two", ErrorB>
				>();
				expect(await runAsync(1)).toEqual(Result.ok("one"));
				expect(await runAsync(2)).toEqual(Result.ok("two"));
				expect(await runAsync(3)).toEqual(Result.error(new ErrorB()));
			});

			it("takes an sync generator function as a transform function", () => {
				const result = Result.ok(1) as Result<number, ErrorA>;
				const nextResult = result.map(function* (value) {
					expectTypeOf(value).toEqualTypeOf<number>();

					const other = yield* Result.ok(2) as Result<number, ErrorB>;

					return value + other;
				});

				expectTypeOf(nextResult).toEqualTypeOf<
					Result<number, ErrorA | ErrorB>
				>();
				Result.assertOk(nextResult);
				expect(nextResult.value).toBe(3);
			});

			it("takes an async generator function as a transform function", async () => {
				const result = Result.ok(1) as Result<number, ErrorA>;
				const nextAsyncResult = result.map(async function* (value) {
					expectTypeOf(value).toEqualTypeOf<number>();

					const other = yield* AsyncResult.ok(2) as AsyncResult<number, ErrorB>;

					return value + other;
				});

				expectTypeOf(nextAsyncResult).toEqualTypeOf<
					AsyncResult<number, ErrorA | ErrorB>
				>();
				expect(nextAsyncResult).toBeInstanceOf(AsyncResult);

				const nextResult = await nextAsyncResult;
				Result.assertOk(nextResult);
				expect(nextResult.value).toBe(3);
			});
		});

		describe("mapCatching", () => {
			it("does track errors thrown inside the transformation function", () => {
				const fn = () =>
					Result.ok(2).mapCatching((): number => {
						throw new CustomError();
					});

				expect(fn).not.to.throw(CustomError);

				const result = fn();
				Result.assertError(result);
				expect(result.error).toBeInstanceOf(CustomError);
			});

			it("catches and encapsulates errors that might be thrown inside the transform function", async () => {
				const result = await Result.ok(2).mapCatching(
					async (): Promise<number> => {
						throw new CustomError();
					},
				);

				Result.assertError(result);
				expect(result.error).toBeInstanceOf(CustomError);
			});

			it("does nothing when the result represents a failure", () => {
				const result = Result.error(new CustomError());

				const spy = vi.fn();
				const nextResult = result.mapCatching(() => {
					spy();
					return 2;
				});

				Result.assertError(nextResult);
				expect(spy).not.toHaveBeenCalled();
			});

			it("allows you to transform any caught error during the mapping", () => {
				const result = Result.ok(2).mapCatching(
					(): number => {
						throw new Error("boom");
					},
					(err) => {
						expectTypeOf(err).toBeUnknown();
						return new ErrorA();
					},
				);

				expectTypeOf(result).toEqualTypeOf<Result<number, ErrorA>>();

				Result.assertError(result);

				expect(result.error).toBeInstanceOf(ErrorA);
			});

			it("throws when an exception is thrown while transforming the error", () => {
				const fn = () =>
					Result.ok(2).mapCatching(
						(): number => {
							throw new CustomError();
						},
						() => {
							throw new Error("boom");
						},
					);

				expect(fn).to.throw(/boom/);
			});

			it("allows you to transform any caught error during async mapping", async () => {
				const result = await (
					Result.ok(2) as Result<number, ErrorA>
				).mapCatching(
					async (): Promise<number> => {
						throw new Error("boom");
					},
					(err) => {
						expectTypeOf(err).toBeUnknown();
						return new ErrorB();
					},
				);

				expectTypeOf(result).toEqualTypeOf<Result<number, ErrorA | ErrorB>>();

				Result.assertError(result);

				expect(result.error).toBeInstanceOf(ErrorB);
			});

			it("merges a union of complex results into a single result", () => {
				const result = Result.ok(2) as
					| Result<number, ErrorA>
					| Result<never, ErrorB>;

				const nextResult = result.mapCatching(
					(value) => value,
					() => new CustomError(),
				);

				expectTypeOf(nextResult).toEqualTypeOf<
					Result<number, CustomError | ErrorA | ErrorB>
				>();

				expectTypeOf(nextResult).not.toEqualTypeOf<
					| Result<number, ErrorA>
					| Result<never, CustomError | ErrorA>
					| Result<number, ErrorB>
					| Result<never, CustomError | ErrorB>
				>();
			});

			it("takes an sync generator function as a transform function", () => {
				const result = Result.ok(1) as Result<number, ErrorA>;
				const nextResult = result.mapCatching(function* (value) {
					expectTypeOf(value).toEqualTypeOf<number>();
					const other = yield* Result.ok(2) as Result<number, ErrorB>;
					return value + other;
				});

				expectTypeOf(nextResult).toEqualTypeOf<
					Result<number, ErrorA | ErrorB | Error>
				>();
				Result.assertOk(nextResult);
				expect(nextResult.value).toBe(3);
			});

			it("takes an async generator function as a transform function", async () => {
				const result = Result.ok(1) as Result<number, ErrorA>;
				const nextAsyncResult = result.mapCatching(async function* (value) {
					expectTypeOf(value).toEqualTypeOf<number>();

					const other = yield* AsyncResult.ok(2) as AsyncResult<number, ErrorB>;

					return value + other;
				});

				expectTypeOf(nextAsyncResult).toEqualTypeOf<
					AsyncResult<number, ErrorA | ErrorB | Error>
				>();
				expect(nextAsyncResult).toBeInstanceOf(AsyncResult);

				const nextResult = await nextAsyncResult;
				Result.assertOk(nextResult);
				expect(nextResult.value).toBe(3);
			});
		});

		describe("mapError", () => {
			it("lets you transform the error of a failed result into a new error", () => {
				const result = Result.error(new ErrorA()) as Result<number, ErrorA>;

				const nextResult = result.mapError((error) => {
					expectTypeOf(error).toEqualTypeOf<ErrorA>();
					return new ErrorB();
				});

				expectTypeOf(nextResult).toEqualTypeOf<Result<number, ErrorB>>();

				Result.assertError(nextResult);

				expect(nextResult.error).toBeInstanceOf(ErrorB);
			});

			it("throws when an exception is thrown while transforming the error", () => {
				const fn = () =>
					Result.error(new ErrorA()).mapError(() => {
						throw new Error("boom");
					});

				expect(fn).to.throw(/boom/);
			});

			it("ignores the operation when the result is ok", () => {
				const result = Result.ok(2);

				const spy = vi.fn();
				const nextResult = result.mapError(spy);

				Result.assertOk(nextResult);
				expect(spy).not.toHaveBeenCalled();
			});
		});

		describe("recover", () => {
			it("allows you to transform a result which represents a failure into a result that represents a success", () => {
				const result = Result.error(new CustomError());

				const recoveredResult = result.recover((error) => {
					expectTypeOf(error).toEqualTypeOf<CustomError>();
					return 10;
				});

				expectTypeOf(recoveredResult).toEqualTypeOf<Result<number, never>>();

				Result.assertOk(recoveredResult);
				expect(recoveredResult).not.toBe(result);
				expect(recoveredResult.value).toBe(10);
			});

			it("does not catch exceptions when the transform function throws an exception", () => {
				const result = Result.error(new CustomError());

				const ERROR = "error";

				expect(() =>
					result.recover((_error) => {
						throw ERROR;
					}),
				).to.throw(ERROR);
			});

			it("gets simply ignored when the result is ok", () => {
				const result = Result.ok(12) as Result<number, CustomError>;

				const transform = vi.fn();
				result.recover(transform);

				expect(transform).not.toHaveBeenCalled();
			});

			it("will convert a success into an async-result when an async transform function was given", async () => {
				const result = Result.ok(12) as Result<number, CustomError>;

				const asyncResult = result.recover(async () => 24);

				expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<number, never>>();
				expect(asyncResult).toBeInstanceOf(AsyncResult);

				const resolvedAsyncResult = await asyncResult;

				// after recovery the result can only be a success, and TS knows this,
				// so we don't have to perform any assertions here
				expectTypeOf(resolvedAsyncResult.value).toEqualTypeOf<number>();

				Result.assertOk(resolvedAsyncResult);
				expect(resolvedAsyncResult.value).toBe(12);
			});

			it("flattens to a result when the transform function returns another result", () => {
				const result = Result.error(new CustomError());

				const recoveredResultA = result.recover(
					() => Result.ok(12) as Result<number, ErrorA>,
				);
				expectTypeOf(recoveredResultA).toEqualTypeOf<Result<number, ErrorA>>();
				Result.assertOk(recoveredResultA);
				expect(recoveredResultA.value).toBe(12);

				const recoveredResultB = result.recover(
					() => Result.error(errorA) as Result<number, ErrorA>,
				);
				expectTypeOf(recoveredResultB).toEqualTypeOf<Result<number, ErrorA>>();
				Result.assertError(recoveredResultB);
				expect(recoveredResultB.error).toEqual(errorA);
			});

			it("handles async transform functions", async () => {
				const result = Result.error(new CustomError());

				const asyncResult = result.recover(async () => Result.ok(12));
				expect(asyncResult).toBeInstanceOf(AsyncResult);
				const recoveredResult = await asyncResult;
				Result.assertOk(recoveredResult);
				expect(recoveredResult.value).toBe(12);
			});

			it("supports a generator function as transform callback", async () => {
				const result = Result.error(new CustomError());

				const recoveredResult = result.recover(function* () {
					return yield* Result.ok(12);
				});
				expect(recoveredResult).toBeInstanceOf(Result);
				Result.assertOk(recoveredResult);
				expect(recoveredResult.value).toBe(12);
			});

			it("supports an async generator function as transform callback", async () => {
				const result = Result.error(new CustomError());

				const recoveredResult = result.recover(async function* () {
					return yield* Result.ok(12);
				});
				expect(recoveredResult).toBeInstanceOf(AsyncResult);
				const resolvedRecoveredResult = await recoveredResult;
				Result.assertOk(resolvedRecoveredResult);
				expect(resolvedRecoveredResult.value).toBe(12);
			});
		});

		describe("recoverCatching", () => {
			it("allows you to transform a result which represents a failure into a result that represents a success", () => {
				const result = Result.error(new CustomError());
				const recoveredResult = result.recoverCatching(() => 12);
				Result.assertOk(recoveredResult);
				expect(recoveredResult.value).toBe(12);
			});

			it("catches exceptions that might be thrown inside the transform function and turns it into a failed result", () => {
				const result = Result.error(new CustomError());
				const recoveredResult = result.recoverCatching((): number => {
					throw new Error("inside transform function");
				});
				Result.assertError(recoveredResult);
				expect(recoveredResult.error.message).toBe("inside transform function");
			});

			it("does nothing when the result is ok", () => {
				const result = Result.ok(12);
				const spy = vi.fn();
				const recoveredResult = result.recoverCatching(() => {
					spy();
					return 12;
				});
				Result.assertOk(recoveredResult);
				expect(spy).not.toHaveBeenCalled();
				expect(recoveredResult.value).toBe(12);
			});

			it("converts the result into an async-result when the transform function is async, even though the result represents a failure", async () => {
				const result = Result.ok(12);
				const spy = vi.fn();
				const recoveredResult = result.recoverCatching(async () => {
					spy();
					return 12;
				});
				expect(recoveredResult).toBeInstanceOf(AsyncResult);
				Result.assertOk(await recoveredResult);
				expect(spy).not.toHaveBeenCalled();
			});

			it("allows you to transform the error that was thrown inside the callback into a new error", () => {
				const result = Result.error(new ErrorA()) as Result<number, ErrorA>;

				const nextResult = result.recoverCatching(
					(error): number => {
						expectTypeOf(error).toEqualTypeOf<ErrorA>();
						throw new CustomError();
					},
					(error) => {
						expect(error).toBeInstanceOf(CustomError);
						return new ErrorB();
					},
				);

				expectTypeOf(nextResult).toEqualTypeOf<Result<number, ErrorB>>();

				Result.assertError(nextResult);

				expect(nextResult.error).toBeInstanceOf(ErrorB);
			});

			it("supports a generator function as transform callback", async () => {
				const result = Result.error(new CustomError());

				const recoveredResult = result.recoverCatching(function* () {
					return yield* Result.ok(12);
				});
				expect(recoveredResult).toBeInstanceOf(Result);
				Result.assertOk(recoveredResult);
				expect(recoveredResult.value).toBe(12);
			});

			it("supports an async generator function as transform callback", async () => {
				const result = Result.error(new CustomError());

				const recoveredResult = result.recoverCatching(async function* () {
					return yield* Result.ok(12);
				});
				expect(recoveredResult).toBeInstanceOf(AsyncResult);
				const resolvedRecoveredResult = await recoveredResult;
				Result.assertOk(resolvedRecoveredResult);
				expect(resolvedRecoveredResult.value).toBe(12);
			});
		});

		describe("match", () => {
			it("allows you to define handlers for specific error cases when the result is a failure", () => {
				const result = Result.error(new ErrorA()) as Result<
					"some value",
					ErrorA | ErrorB
				>;

				expectTypeOf(
					result.match(),
				).toEqualTypeOf<"'match()' can only be called on a failed result. Please narrow the result by checking the 'ok' property.">();

				expect(result.ok).toBe(false);

				if (!result.ok) {
					const outcome = result
						.match()
						.when(ErrorA, (error) => {
							expectTypeOf(error).toEqualTypeOf<ErrorA>();
							return "a" as const;
						})
						.when(ErrorB, (error) => {
							expectTypeOf(error).toEqualTypeOf<ErrorB>();
							return "b" as const;
						})
						.run();

					expectTypeOf(outcome).toEqualTypeOf<"a" | "b">();
					expect(outcome).toEqual("a");
				}
			});

			it("throws when trying to match on a successful result", () => {
				const result = Result.ok();

				expect(() =>
					result
						.match()
						// @ts-expect-error
						.when(ErrorA, () => 12),
				).toThrow(/undefined/);
			});

			it("returns a promise when one of the handlers is async", async () => {
				const resultA = Result.error(new ErrorA()) as Result<
					"some value",
					ErrorA | ErrorB
				>;
				const resultB = Result.error(new ErrorB()) as Result<
					"some value",
					ErrorA | ErrorB
				>;

				Result.assertError(resultA);
				Result.assertError(resultB);

				const outcomeA = resultA
					.match()
					.when(ErrorA, () => "a" as const)
					.when(ErrorB, async () => "b" as const)
					.run();

				expectTypeOf(outcomeA).toEqualTypeOf<Promise<"a" | "b">>();
				expect(outcomeA).toBeInstanceOf(Promise);
				const resolvedA = await outcomeA;
				expect(resolvedA).toBe("a");

				const outcomeB = resultB
					.match()
					.when(ErrorA, () => "a" as const)
					.when(ErrorB, async () => "b" as const)
					.run();

				expectTypeOf(outcomeB).toEqualTypeOf<Promise<"a" | "b">>();
				expect(outcomeB).toBeInstanceOf(Promise);
				const resolvedB = await outcomeB;
				expect(resolvedB).toBe("b");
			});

			it("allows you to combine multiple cases in one when-statement", () => {
				const result = Result.error(new ErrorA()) as Result.Error<
					ErrorA | ErrorB
				>;

				const outcome = result
					.match()
					.when(ErrorA, ErrorB, (error) => {
						expectTypeOf(error).toEqualTypeOf<ErrorA | ErrorB>();
						return error.type;
					})
					.run();

				expectTypeOf(outcome).toBeString();
				expect(outcome).toBe("a");
			});

			it("throws when an unexpected case was reached", () => {
				const err = new ErrorA();
				const result = Result.error(err) as Result.Error<ErrorA | ErrorB>;

				expectTypeOf(result.match().when(ErrorB, () => "b").run).toEqualTypeOf<
					NonExhaustiveError<ErrorA>
				>();

				expect(() =>
					result
						.match()
						.when(ErrorB, () => "b")
						// @ts-expect-error
						.run(),
				).to.toThrowError(new NonExhaustiveError(err));
			});

			it("accepts literal values as well", () => {
				const result = Result.error("error-c") as Result.Error<
					"error-a" | "error-b" | "error-c"
				>;

				const outcome = result
					.match()
					.when("error-a", () => "a")
					.when("error-b", "error-c", () => "b-or-c")
					.run();

				expect(outcome).toBe("b-or-c");
			});

			it("accepts an 'else' case", () => {
				const resultA = Result.error(new ErrorA()) as Result.Error<
					ErrorA | ErrorB
				>;
				const resultB = Result.error(new ErrorB()) as Result.Error<
					ErrorA | ErrorB
				>;

				const outcomeA = resultA
					.match()
					.when(ErrorA, () => "a" as const)
					.else((error) => {
						expectTypeOf(error).toEqualTypeOf<ErrorB>();
						return "else" as const;
					})
					.run();

				expectTypeOf(outcomeA).toEqualTypeOf<"a" | "else">();
				expect(outcomeA).toBe("a");

				const outcomeB = resultB
					.match()
					.when(ErrorA, () => "a" as const)
					.else(() => "else" as const)
					.run();

				expect(outcomeB).toBe("else");
			});

			it("does not allow you to call 'else' when all cases are already handled", () => {
				const result = Result.error(new ErrorA()) as Result.Error<
					ErrorA | ErrorB
				>;

				expectTypeOf(
					result.match().when(ErrorA, ErrorB, () => "foo").else,
				).toEqualTypeOf<
					RedundantElseClauseError<"All error cases are already handled">
				>();
			});

			it("does not allow you to use 'else' more than once", () => {
				const result = Result.error(new ErrorA()) as Result.Error<
					ErrorA | ErrorB
				>;

				expect(() =>
					result
						.match()
						.else(() => "else")
						// @ts-expect-error
						.else(() => "else2"),
				).toThrow(/already registered/);
			});
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
		expectTypeOf(resultA).toEqualTypeOf<Result<never, ErrorA>>();

		const resultB = syncFailure.map(async () => Result.ok(12));
		// It should disregard the async mapping as well
		expectTypeOf(resultB).toEqualTypeOf<Result<never, ErrorA>>();

		const resultC = syncFailure.mapCatching(() => Result.ok(12));
		expectTypeOf(resultC).toEqualTypeOf<Result<never, ErrorA>>();

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
		expectTypeOf(resultA).toEqualTypeOf<Result<number, never>>();

		const resultB = syncSuccess.recover(async () => Result.error(new ErrorA()));
		expectTypeOf(resultB).toEqualTypeOf<Result<number, never>>();

		const resultC = syncSuccess.recoverCatching(() =>
			Result.error(new ErrorA()),
		);
		expectTypeOf(resultC).toEqualTypeOf<Result<number, never>>();

		const resultD = asyncSuccess.recover(() => Result.error(new ErrorA()));
		expectTypeOf(resultD).toEqualTypeOf<AsyncResult<number, never>>();

		const resultE = asyncSuccess.recoverCatching(() =>
			Result.error(new ErrorA()),
		);
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

describe("AsyncResult", () => {
	describe("AsyncResult.fromPromise", () => {
		it("transforms a promise into an async-result", async () => {
			const asyncResult = AsyncResult.fromPromise(Promise.resolve(12));
			expect(asyncResult).toBeInstanceOf(AsyncResult);

			const result = await asyncResult;
			expect(result).toBeInstanceOf(Result);
			Result.assertOk(result);
			expect(result.value).toBe(12);
		});

		it("does not track errors but throws them instead", async () => {
			await expect(() =>
				AsyncResult.fromPromise(Promise.reject(errorA)),
			).rejects.toBeInstanceOf(ErrorA);
		});
	});

	describe("AsyncResult.fromPromiseCatching", () => {
		it("transforms a promise into an async-result", async () => {
			const asyncResult = AsyncResult.fromPromiseCatching(Promise.resolve(12));
			expect(asyncResult).toBeInstanceOf(AsyncResult);

			const result = await asyncResult;
			expect(result).toBeInstanceOf(Result);
			Result.assertOk(result);
			expect(result.value).toBe(12);
		});

		it("does catch any errors and encapsulates them as part of a failed result", async () => {
			const result = await AsyncResult.fromPromiseCatching(
				Promise.reject(errorA),
			);

			expect(result).toBeInstanceOf(Result);
			Result.assertError(result);
			expect(result.error).toBe(errorA);
		});
	});

	describe("AsyncResult.ok", () => {
		it("creates a successful async-result", async () => {
			const asyncResult = AsyncResult.ok(12);
			expect(asyncResult).toBeInstanceOf(AsyncResult);

			const result = await asyncResult;
			expect(result).toBeInstanceOf(Result);
			Result.assertOk(result);
			expect(result.value).toBe(12);
		});
	});

	describe("AsyncResult.error", () => {
		it("creates a failed async-result", async () => {
			const asyncResult = AsyncResult.error(errorA);
			expect(asyncResult).toBeInstanceOf(AsyncResult);

			const result = await asyncResult;
			expect(result).toBeInstanceOf(Result);
			Result.assertError(result);
			expect(result.error).toBe(errorA);
		});
	});

	describe("instance methods and getters", () => {
		describe("$inferValue / $inferError", () => {
			it("infers the value and error type of a result", () => {
				const result: AsyncResult<number, ErrorA> = AsyncResult.ok(42);

				expectTypeOf(result.$inferValue).toEqualTypeOf<number>();
				expectTypeOf(result.$inferError).toEqualTypeOf<ErrorA>();
			});
		});

		describe("isAsyncResult", () => {
			it("tests whether a value is an async-result", () => {
				const asyncResult = AsyncResult.ok(12);
				expect(asyncResult.isAsyncResult).toBe(true);
			});
		});

		describe("toTuple", () => {
			it("returns a tuple on a successful result", async () => {
				const result = AsyncResult.ok(2) as AsyncResult<number, ErrorA>;

				const [value, error] = await result.toTuple();
				expectTypeOf(value).toEqualTypeOf<number | null>();
				expectTypeOf(error).toEqualTypeOf<ErrorA | null>();
				if (error) {
					expectTypeOf(error).toEqualTypeOf<ErrorA>();
				} else {
					expectTypeOf(value).toEqualTypeOf<number>();
				}

				expect(value).toBe(2);
				expect(error).toBeNull();
			});

			it("returns a tuple on a failed result", async () => {
				const result: AsyncResult<number, ErrorA> = AsyncResult.error(errorA);

				const [value, error] = await result.toTuple();
				if (error) {
					expectTypeOf(error).toEqualTypeOf<ErrorA>();
				} else {
					expectTypeOf(value).toEqualTypeOf<number>();
				}

				expect(value).toBeNull();
				expect(error).toBe(errorA);
			});

			it("handles cases where the result can only be successful", async () => {
				const result = AsyncResult.ok(12);

				const [value, error] = await result.toTuple();
				expectTypeOf(value).toEqualTypeOf<number>();
				expectTypeOf(error).toEqualTypeOf<never>();
				expect(value).toBe(12);
				expect(error).toBe(null);
			});

			it("handles cases where the result can only be a failure", async () => {
				const result = AsyncResult.error(errorA);

				const [value, error] = await result.toTuple();
				expectTypeOf(value).toEqualTypeOf<never>();
				expectTypeOf(error).toEqualTypeOf<ErrorA>();
				expect(value).toBe(null);
				expect(error).toBe(errorA);
			});
		});

		describe("errorOrNull", async () => {
			it("returns the error on failure", async () => {
				const asyncResult = AsyncResult.error(errorA) as AsyncResult<
					number,
					ErrorA
				>;
				const outcome = await asyncResult.errorOrNull();

				expectTypeOf(outcome).toEqualTypeOf<ErrorA | null>();
				expect(outcome).toBe(errorA);
			});

			it("returns null on success", async () => {
				const asyncResult = AsyncResult.ok(2) as AsyncResult<number, ErrorA>;
				const outcome = await asyncResult.errorOrNull();
				expectTypeOf(outcome).toEqualTypeOf<ErrorA | null>();
				expect(outcome).toBe(null);
			});

			it("is aware whether there is a possible error or not", async () => {
				const okResult = AsyncResult.ok(42);
				expectTypeOf(okResult).toEqualTypeOf<AsyncResult<number, never>>();
				// since the error type is 'never', in this case, the error can only be null
				expectTypeOf(await okResult.errorOrNull()).toEqualTypeOf<null>();
			});
		});

		describe("getOrNull", () => {
			it("returns null on failure", async () => {
				const result: AsyncResult<number, CustomError> = AsyncResult.error(
					new CustomError(),
				);

				expectTypeOf(await result.getOrNull()).toEqualTypeOf<number | null>();

				expect(await result.getOrNull()).toBe(null);
			});

			it("returns the encapsulated value on success", async () => {
				const result: AsyncResult<number, CustomError> = AsyncResult.ok(2);

				expectTypeOf(await result.getOrNull()).toEqualTypeOf<number | null>();

				expect(await result.getOrNull()).toBe(2);
			});

			it("is aware whether there is a possible error or not", async () => {
				const okResult = AsyncResult.ok(42);
				expectTypeOf(await okResult).toEqualTypeOf<Result<number, never>>();
				// since the error type is 'never', in this case, the error can only be a number
				expectTypeOf(await okResult.getOrNull()).toEqualTypeOf<number>();

				const failureResult = AsyncResult.error(new CustomError());
				expectTypeOf(await failureResult).toEqualTypeOf<
					Result<never, CustomError>
				>();
				// since the value type is 'never', in this case, the value can only be a number
				expectTypeOf(await failureResult.getOrNull()).toEqualTypeOf<null>();
			});
		});

		describe("toString", () => {
			it("returns a string friendly version", () => {
				const result = AsyncResult.error(errorA);

				expect(result.toString()).toBe("AsyncResult");
			});
		});

		describe("getOrDefault", () => {
			it("returns the encapsulated value when the result is ok", async () => {
				const result = AsyncResult.ok(2);

				const outcome = await result.getOrDefault(4);

				expectTypeOf(outcome).toEqualTypeOf<number>();
				expect(outcome).toBe(2);
			});

			it("returns the provided default value when the result represents a failure", async () => {
				const result = AsyncResult.error(new CustomError()) as AsyncResult<
					number,
					CustomError
				>;

				const outcome = await result.getOrDefault(4);

				expectTypeOf(outcome).toEqualTypeOf<number>();
				expect(outcome).toBe(4);
			});
		});

		describe("getOrElse", () => {
			it("returns the encapsulated value when the result is ok", async () => {
				const result = AsyncResult.ok(2);

				const elseFn = vi.fn().mockReturnValue(4) as () => number;

				expect(await result.getOrElse(elseFn)).toBe(2);
				expect(elseFn).not.toHaveBeenCalled();
			});

			it("returns the result of the matching handler function for the encapsulated error type if it is a failure", async () => {
				const result = AsyncResult.error(new CustomError()) as AsyncResult<
					number,
					CustomError
				>;

				const outcome = await result.getOrElse((error) => {
					expectTypeOf(error).toEqualTypeOf<CustomError>();
					return 4;
				});

				expect(outcome).toBe(4);
			});

			it("also accepts an async callback", async () => {
				const result = AsyncResult.error(new CustomError()) as AsyncResult<
					number,
					CustomError
				>;

				const outcome = result.getOrElse(async (error) => {
					expectTypeOf(error).toEqualTypeOf<CustomError>();
					return 4;
				});

				expectTypeOf(outcome).toEqualTypeOf<Promise<number>>();
				expect(await outcome).toBe(4);
			});

			it("throws an error when the callback throws an error", async () => {
				await expect(() =>
					AsyncResult.error(errorA).getOrElse(() => {
						throw new CustomError();
					}),
				).rejects.toThrow(CustomError);
			});
		});

		describe("getOrThrow", () => {
			it("returns the encapsulated value when the result is ok", async () => {
				const result = AsyncResult.ok(2);

				expectTypeOf(await result.getOrThrow()).toEqualTypeOf<number>();
				expect(await result.getOrThrow()).toBe(2);
			});

			it("throws the encapsulated error when the result represents a failure", async () => {
				const result = AsyncResult.error(new CustomError());

				await expect(() => result.getOrThrow()).rejects.toThrow(CustomError);
			});
		});

		describe("fold", () => {
			it("returns the result of the onSuccess-callback for the encapsulated value if this instance represents success", async () => {
				const result: AsyncResult<number, ErrorA> = AsyncResult.ok(2);

				const spy = vi.fn();

				const number = await result.fold(
					(value) => {
						expectTypeOf(value).toEqualTypeOf<number>();
						return value * 2;
					},
					(error) => {
						expectTypeOf(error).toEqualTypeOf<ErrorA>();
						spy();
						return 123;
					},
				);

				expectTypeOf(number).toEqualTypeOf<number>();
				expect(number).toBe(4);
				expect(spy).not.toHaveBeenCalled();
			});

			it("returns the result of the onFailure-callback for the encapsulated error if it is a failure", async () => {
				const result: AsyncResult<number, string> =
					AsyncResult.error("some failure");

				const spy = vi.fn();

				const message = await result.fold(
					(value) => {
						expectTypeOf(value).toEqualTypeOf<number>();

						spy();

						return "some value";
					},
					(error) => error.toUpperCase(),
				);

				expectTypeOf(message).toEqualTypeOf<string>();
				expect(message).toBe("SOME FAILURE");
				expect(spy).not.toHaveBeenCalled();
			});

			it("handles async handlers as well", async () => {
				const result: AsyncResult<number, string> =
					AsyncResult.error("some failure");

				const outcome = result.fold(
					(value) => {
						expectTypeOf(value).toEqualTypeOf<number>();
						return "some value";
					},
					async (error) => error.toUpperCase(),
				);

				expectTypeOf(outcome).toEqualTypeOf<Promise<string>>();

				expect(await outcome).toBe("SOME FAILURE");
			});

			it("throws an error when the callback throws an error", async () => {
				await expect(() =>
					AsyncResult.error(errorA).fold(
						() => null,
						() => {
							throw new CustomError();
						},
					),
				).rejects.toThrow(CustomError);
			});
		});

		describe("onFailure", () => {
			it("allows you to execute a side-effect when dealing with a failure", async () => {
				const result = AsyncResult.error(errorA);

				const spy = vi.fn();

				const outcome = result.onFailure((error) => {
					expectTypeOf(error).toEqualTypeOf<ErrorA>();
					spy();
				});

				expectTypeOf(outcome).toEqualTypeOf<typeof result>();
				await result;
				expect(spy).toHaveBeenCalled();
			});

			it("does not call the provided callback when dealing with a successful result", async () => {
				const result = AsyncResult.ok(1);

				const callback = vi.fn();
				await result.onFailure(callback);

				expect(callback).not.toHaveBeenCalled();
			});

			it("handles async callbacks as well", async () => {
				const result = AsyncResult.error(errorA);

				const spy = vi.fn();

				const outcome = result.onFailure(async (error) => {
					await sleep();
					expectTypeOf(error).toEqualTypeOf<ErrorA>();
					spy();
				});

				expectTypeOf(outcome).toEqualTypeOf<typeof result>();
				await outcome;
				expect(spy).toHaveBeenCalled();
			});

			it("handles callbacks that return a promise as well", async () => {
				const result = AsyncResult.error(errorA);

				const spy = vi.fn();

				await result.onFailure(() => Promise.resolve().then(sleep).then(spy));

				expect(spy).toHaveBeenCalled();
			});

			it("throws an error when the callback throws an error", async () => {
				await expect(() =>
					AsyncResult.error(errorA).onFailure(() => {
						throw new CustomError();
					}),
				).rejects.toThrow(CustomError);
			});
		});

		describe("onSuccess", () => {
			it("allows you to execute a side-effect when dealing with a successful result", async () => {
				const result = AsyncResult.ok(12);

				const spy = vi.fn();

				const outcome = await result.onSuccess((value) => {
					expectTypeOf(value).toEqualTypeOf<number>();
					spy();
				});

				expectTypeOf(outcome).toEqualTypeOf<Awaited<typeof result>>();
				expect(outcome).toBe(await result);
				expect(spy).toHaveBeenCalled();
			});

			it("does not call the on-success handler when the result represents a failure", async () => {
				const result = AsyncResult.error(new CustomError());

				const handler = vi.fn();
				await result.onSuccess(handler);

				expect(handler).not.toHaveBeenCalled();
			});

			it("accepts an async callback as well", async () => {
				const result = AsyncResult.ok(12);

				const spy = vi.fn();

				const outcome = result.onSuccess(async (value) => {
					await sleep();
					spy();
					expectTypeOf(value).toEqualTypeOf<number>();
				});

				expectTypeOf(outcome).toEqualTypeOf<typeof result>();
				expect(outcome).toBeInstanceOf(AsyncResult);
				await outcome;
				expect(spy).toHaveBeenCalled();
			});

			it("throws an error when the callback throws an error", async () => {
				await expect(() =>
					AsyncResult.ok(12).onSuccess(() => {
						throw new CustomError();
					}),
				).rejects.toThrow(CustomError);
			});

			it("handles callbacks that return a promise as well", async () => {
				const result = AsyncResult.ok(12);

				const spy = vi.fn();

				await result.onSuccess(() => Promise.resolve().then(sleep).then(spy));

				expect(spy).toHaveBeenCalled();
			});
		});

		describe("map", () => {
			it("maps an encapsulated successful value to a next result using a transform function", async () => {
				const result = AsyncResult.ok(2);
				const nextResult = result.map((value) => value * 2);
				expectTypeOf(nextResult).toEqualTypeOf<AsyncResult<number, never>>();
				const resolvedResult = await nextResult;
				Result.assertOk(resolvedResult);
				expect(resolvedResult.value).toBe(4);
			});

			it("maps an encapsulated successful value to an async-result using an async transform function", async () => {
				const result = AsyncResult.ok(2);
				const nextAsyncResult = result.map(async (value) => value * 2);
				expectTypeOf(nextAsyncResult).toEqualTypeOf<
					AsyncResult<number, never>
				>();
				expect(nextAsyncResult).toBeInstanceOf(AsyncResult);

				const nextResult = await nextAsyncResult;

				Result.assertOk(nextResult);
				expect(nextResult.value).toBe(4);
			});

			it("lets you map over an encapsulated failed value by simply ignoring the transform function and returning the failed result", async () => {
				const result = AsyncResult.error(new CustomError()) as AsyncResult<
					number,
					CustomError
				>;

				const spy = vi.fn();
				const nextResult = result.map((value) => {
					spy();
					return value * 2;
				});

				expectTypeOf(nextResult).toEqualTypeOf<
					AsyncResult<number, CustomError>
				>();
				expect(spy).not.toHaveBeenCalled();

				// Async result will always return a new instance
				expect(result).not.toBe(nextResult);

				const resolvedResult = await nextResult;
				Result.assertError(resolvedResult);
				expect(resolvedResult.error).toBeInstanceOf(CustomError);
			});

			it("flattens a returning result from the transformation", async () => {
				const result = AsyncResult.ok(2);
				const nextResult = result.map((value) => Result.ok(value * 2));
				expectTypeOf(nextResult).toEqualTypeOf<AsyncResult<number, never>>();

				const resolvedResult = await nextResult;
				Result.assertOk(resolvedResult);
				expect(resolvedResult.value).toBe(4);
				expect(result).not.toBe(nextResult);
			});

			it("flattens a returning result from the async transformation", async () => {
				const result = AsyncResult.ok(2);
				const nextAsyncResult = result.map(async (value) =>
					Result.ok(value * 2),
				);
				expectTypeOf(nextAsyncResult).toEqualTypeOf<
					AsyncResult<number, never>
				>();

				const nextResult = await nextAsyncResult;

				Result.assertOk(nextResult);
				expect(nextResult.value).toBe(4);
				expect(result).not.toBe(nextResult);
			});

			it("flattens a returning async-result from the transformation", async () => {
				const result = AsyncResult.ok(2);
				const otherAsyncResult = Result.fromAsync(
					Promise.resolve("some value"),
				);

				const nextAsyncResult = result.map(() => otherAsyncResult);
				expectTypeOf(nextAsyncResult).toEqualTypeOf<
					AsyncResult<string, never>
				>();

				const nextResult = await nextAsyncResult;

				Result.assertOk(nextResult);
				expect(nextResult.value).toBe("some value");
				expect(result).not.toBe(nextResult);
			});

			it("does not track errors thrown inside the transformation function", async () => {
				await expect(() =>
					AsyncResult.ok(2).map((): number => {
						throw new CustomError();
					}),
				).rejects.toThrow(CustomError);
			});

			it("takes an sync generator function as a transform function", async () => {
				const asyncResult = AsyncResult.ok(1) as AsyncResult<number, ErrorA>;
				const nextAsyncResult = asyncResult.map(function* (value) {
					expectTypeOf(value).toEqualTypeOf<number>();

					const other = yield* Result.ok(2) as Result<number, ErrorB>;

					return value + other;
				});

				expectTypeOf(nextAsyncResult).toEqualTypeOf<
					AsyncResult<number, ErrorA | ErrorB>
				>();
				expect(nextAsyncResult).toBeInstanceOf(AsyncResult);

				const nextResult = await nextAsyncResult;
				Result.assertOk(nextResult);
				expect(nextResult.value).toBe(3);
			});

			it("takes an async generator function as a transform function", async () => {
				const asyncResult = AsyncResult.ok(1) as AsyncResult<number, ErrorA>;
				const nextAsyncResult = asyncResult.map(async function* (value) {
					expectTypeOf(value).toEqualTypeOf<number>();

					const other = yield* AsyncResult.ok(2) as AsyncResult<number, ErrorB>;

					return value + other;
				});

				expectTypeOf(nextAsyncResult).toEqualTypeOf<
					AsyncResult<number, ErrorA | ErrorB>
				>();
				expect(nextAsyncResult).toBeInstanceOf(AsyncResult);

				const nextResult = await nextAsyncResult;
				Result.assertOk(nextResult);
				expect(nextResult.value).toBe(3);
			});
		});

		describe("mapCatching", () => {
			it("does track errors thrown inside the transformation function", async () => {
				const result = await AsyncResult.ok(2).mapCatching((): number => {
					throw new CustomError();
				});
				Result.assertError(result);
				expect(result.error).toBeInstanceOf(CustomError);
			});

			it("catches and encapsulates errors that might be thrown inside the transform function", async () => {
				const result = await AsyncResult.ok(2).mapCatching(
					async (): Promise<number> => {
						throw new CustomError();
					},
				);

				Result.assertError(result);
				expect(result.error).toBeInstanceOf(CustomError);
			});

			it("allows you to transform any caught error during the mapping", async () => {
				const asyncResult = AsyncResult.ok(2).mapCatching(
					(): number => {
						throw new Error("boom");
					},
					(err) => {
						expectTypeOf(err).toBeUnknown();
						return new ErrorA();
					},
				);

				expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<number, ErrorA>>();

				const result = await asyncResult;

				Result.assertError(result);

				expect(result.error).toBeInstanceOf(ErrorA);
			});

			it("throws when an exception is thrown while transforming the error", async () => {
				const fn = () =>
					AsyncResult.ok(2).mapCatching(
						(): number => {
							throw new CustomError();
						},
						() => {
							throw new Error("boom");
						},
					);

				await expect(fn).rejects.toThrow(/boom/);
			});

			it("allows you to transform any caught error during async mapping", async () => {
				const result = await (
					AsyncResult.ok(2) as AsyncResult<number, ErrorA>
				).mapCatching(
					async (): Promise<number> => {
						throw new Error("boom");
					},
					(err) => {
						expectTypeOf(err).toBeUnknown();
						return new ErrorB();
					},
				);

				expectTypeOf(result).toEqualTypeOf<Result<number, ErrorA | ErrorB>>();

				Result.assertError(result);

				expect(result.error).toBeInstanceOf(ErrorB);
			});
		});

		describe("mapError", () => {
			it("lets you transform the error of a failed result into a new error", async () => {
				const result = AsyncResult.error(new ErrorA()) as AsyncResult<
					number,
					ErrorA
				>;

				const nextResult = result.mapError((error) => {
					expectTypeOf(error).toEqualTypeOf<ErrorA>();
					return new ErrorB();
				});

				expectTypeOf(nextResult).toEqualTypeOf<AsyncResult<number, ErrorB>>();

				const resolvedNextResult = await nextResult;

				Result.assertError(resolvedNextResult);

				expect(resolvedNextResult.error).toBeInstanceOf(ErrorB);
			});

			it("throws when an exception is thrown while transforming the error", async () => {
				const fn = () =>
					AsyncResult.error(new ErrorA()).mapError(() => {
						throw new Error("boom");
					});

				await expect(fn).rejects.toThrow(/boom/);
			});

			it("ignores the operation when the result is ok", async () => {
				const result = AsyncResult.ok(2);

				const spy = vi.fn();
				const nextResult = await result.mapError(spy);

				Result.assertOk(nextResult);
				expect(spy).not.toHaveBeenCalled();
			});
		});

		describe("recover", () => {
			it("allows you to transform a result which represents a failure into a result that represents a success", async () => {
				const result = AsyncResult.error(new CustomError());

				const recoveredResult = await result.recover((error) => {
					expectTypeOf(error).toEqualTypeOf<CustomError>();
					return 10;
				});

				expectTypeOf(recoveredResult).toEqualTypeOf<Result<number, never>>();

				Result.assertOk(recoveredResult);
				expect(recoveredResult).not.toBe(result);
				expect(recoveredResult.value).toBe(10);
			});

			it("does not catch exceptions when the transform function throws an exception", async () => {
				const result = AsyncResult.error(new CustomError());

				const ERROR = "error";

				await expect(() =>
					result.recover((_error) => {
						throw ERROR;
					}),
				).rejects.toThrow(ERROR);
			});

			it("gets simply ignored when the result is ok", async () => {
				const result = AsyncResult.ok(12) as AsyncResult<number, CustomError>;

				const transform = vi.fn();
				await result.recover(transform);

				expect(transform).not.toHaveBeenCalled();
			});

			it("will convert a success into an async-result when an async transform function was given", async () => {
				const result = AsyncResult.ok(12) as AsyncResult<number, CustomError>;

				const asyncResult = result.recover(async () => 24);

				expectTypeOf(asyncResult).toEqualTypeOf<AsyncResult<number, never>>();
				expect(asyncResult).toBeInstanceOf(AsyncResult);

				const resolvedAsyncResult = await asyncResult;

				// after recovery the result can only be a success, and TS knows this,
				// so we don't have to perform any assertions here
				expectTypeOf(resolvedAsyncResult.value).toEqualTypeOf<number>();

				Result.assertOk(resolvedAsyncResult);
				expect(resolvedAsyncResult.value).toBe(12);
			});

			it("flattens to a result when the transform function returns another result", async () => {
				const result = AsyncResult.error(new CustomError());

				const recoveredResultA = await result.recover(
					() => Result.ok(12) as Result<number, ErrorA>,
				);
				expectTypeOf(recoveredResultA).toEqualTypeOf<Result<number, ErrorA>>();
				Result.assertOk(recoveredResultA);
				expect(recoveredResultA.value).toBe(12);

				const recoveredResultB = await result.recover(
					() => Result.error(errorA) as Result<number, ErrorA>,
				);
				expectTypeOf(recoveredResultB).toEqualTypeOf<Result<number, ErrorA>>();
				Result.assertError(recoveredResultB);
				expect(recoveredResultB.error).toEqual(errorA);
			});

			it("handles async transform functions", async () => {
				const result = AsyncResult.error(new CustomError());

				const asyncResult = result.recover(async () => Result.ok(12));
				expect(asyncResult).toBeInstanceOf(AsyncResult);
				const recoveredResult = await asyncResult;
				Result.assertOk(recoveredResult);
				expect(recoveredResult.value).toBe(12);
			});

			it("throws an error when the callback throws an error", async () => {
				await expect(() =>
					AsyncResult.error(errorA).recover(() => {
						throw new CustomError();
					}),
				).rejects.toThrow(CustomError);
			});

			it("supports a generator function as transform callback", async () => {
				const asyncResult = AsyncResult.error(new CustomError());

				const asyncRecoveredResult = asyncResult.recover(function* () {
					return yield* Result.ok(12);
				});
				expect(asyncRecoveredResult).toBeInstanceOf(AsyncResult);
				const resolvedRecoveredResult = await asyncRecoveredResult;
				Result.assertOk(resolvedRecoveredResult);
				expect(resolvedRecoveredResult.value).toBe(12);
			});

			it("supports an async generator function as transform callback", async () => {
				const asyncResult = AsyncResult.error(new CustomError());

				const recoveredAsyncResult = asyncResult.recover(async function* () {
					return yield* Result.ok(12);
				});
				expect(recoveredAsyncResult).toBeInstanceOf(AsyncResult);
				const resolvedRecoveredResult = await recoveredAsyncResult;
				Result.assertOk(resolvedRecoveredResult);
				expect(resolvedRecoveredResult.value).toBe(12);
			});
		});

		describe("recoverCatching", () => {
			it("allows you to transform a result which represents a failure into a result that represents a success", async () => {
				const result = AsyncResult.error(new CustomError());
				const recoveredResult = await result.recoverCatching(() => 12);
				Result.assertOk(recoveredResult);
				expect(recoveredResult.value).toBe(12);
			});

			it("catches exceptions that might be thrown inside the transform function and turns it into a failed result", async () => {
				const result = AsyncResult.error(new CustomError());
				const recoveredResult = await result.recoverCatching((): number => {
					throw new Error("inside transform function");
				});
				Result.assertError(recoveredResult);
				expect(recoveredResult.error.message).toBe("inside transform function");
			});
		});
	});
});
