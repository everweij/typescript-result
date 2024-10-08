import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { AsyncResult, Result } from "./result.js";

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
			expectTypeOf(okResult).toEqualTypeOf<Result<number, never>>();
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
			expectTypeOf(failureResult).toEqualTypeOf<Result<never, ErrorA>>();
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

		it("returns an asyc-function that executes a given async-function and returns the successful outcome in a async-result", async () => {
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

		it("returns an asyc-function that executes a given async-function and returns the failed outcome in a async-result", async () => {
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

		it("takes a single succesful async-result and combines it into one successful async-result", async () => {
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
	});

	describe("instance methods and getters", () => {
		describe("value", () => {
			it("returns the encapsulated value on success", () => {
				const result: Result<number, ErrorA> = Result.ok(42);
				expectTypeOf(result.value).toEqualTypeOf<number | undefined>();
				expect(result.value).toBe(42);
			});

			it("is aware whether there is a possible error or not", () => {
				const result = Result.ok(42);
				expectTypeOf(result).toEqualTypeOf<Result<number, never>>();
				// since the error type is 'never', in this case, the value can only be a number
				expectTypeOf(result.value).toEqualTypeOf<number>();
			});

			it("is aware whether there is a possible value or not", () => {
				const result = Result.error(errorA);
				expectTypeOf(result).toEqualTypeOf<Result<never, ErrorA>>();
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
				const result: Result<number, ErrorA> = Result.error(errorA);
				expectTypeOf(result.error).toEqualTypeOf<ErrorA | undefined>();
				expect(result.error).toEqual(errorA);
			});

			it("is aware whether there is a possible value or not", () => {
				const result = Result.error(errorA);
				expectTypeOf(result).toEqualTypeOf<Result<never, ErrorA>>();
				// since the value type is 'never', in this case, the error can only be of type 'ErrorA'
				expectTypeOf(result.error).toEqualTypeOf<ErrorA>();
			});

			it("is aware whether there is a possible error or not", () => {
				const result = Result.ok(42);
				expectTypeOf(result).toEqualTypeOf<Result<number, never>>();
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
				const result: Result<number, ErrorA> = Result.ok(42);
				expect(result.isOk()).toBe(true);

				if (result.isOk()) {
					expectTypeOf(result).toEqualTypeOf<Result<number, never>>();
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
					expectTypeOf(result).toEqualTypeOf<Result<never, ErrorA>>();
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
					expectTypeOf(result).toEqualTypeOf<Result<never, ErrorA>>();
				}
			});
		});

		describe("errorOrNull", () => {
			it("returns the error on failure", () => {
				const result: Result<number, CustomError> = Result.error(
					new CustomError(),
				);

				expectTypeOf(result.errorOrNull()).toEqualTypeOf<CustomError | null>();

				expect(result.errorOrNull()).toBeInstanceOf(CustomError);
			});

			it("returns null on success", () => {
				const result: Result<number, CustomError> = Result.ok(2);

				// Note: TS is smart enough to know that in this case there will never be an error
				// because of the Result<number, never> type.
				expectTypeOf(result.errorOrNull()).toEqualTypeOf<CustomError | null>();

				expect(result.errorOrNull()).toBe(null);
			});

			it("is aware whether there is a possible value or not", () => {
				const failureResult = Result.error(new CustomError());
				expectTypeOf(failureResult).toEqualTypeOf<Result<never, CustomError>>();
				// since the value type is 'never', in this case, the error can only be of type 'CustomError'
				expectTypeOf(failureResult.errorOrNull()).toEqualTypeOf<CustomError>();

				const okResult = Result.ok(42);
				expectTypeOf(okResult).toEqualTypeOf<Result<number, never>>();
				// since the error type is 'never', in this case, the error can only be null
				expectTypeOf(okResult.errorOrNull()).toEqualTypeOf<null>();
			});
		});

		describe("getOrNull", () => {
			it("returns null on failure", () => {
				const result: Result<number, CustomError> = Result.error(
					new CustomError(),
				);

				expectTypeOf(result.getOrNull()).toEqualTypeOf<number | null>();

				expect(result.getOrNull()).toBe(null);
			});

			it("returns the encapsulated value on success", () => {
				const result: Result<number, CustomError> = Result.ok(2);

				expectTypeOf(result.getOrNull()).toEqualTypeOf<number | null>();

				expect(result.getOrNull()).toBe(2);
			});

			it("is aware whether there is a possible error or not", () => {
				const okResult = Result.ok(42);
				expectTypeOf(okResult).toEqualTypeOf<Result<number, never>>();
				// since the error type is 'never', in this case, the error can only be a number
				expectTypeOf(okResult.getOrNull()).toEqualTypeOf<number>();

				const failureResult = Result.error(new CustomError());
				expectTypeOf(failureResult).toEqualTypeOf<Result<never, CustomError>>();
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

				expect(() => result.getOrThrow()).toThrow(
					/Expected a value, but got an error instead/i,
				);
			});
		});

		describe("fold", () => {
			it("returns the result of the onSuccess-callback for the encapsulated value if this instance represents success", () => {
				const result: Result<number, ErrorA> = Result.ok(2);

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
				const result: Result<number, string> = Result.error("some failure");

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
				expectTypeOf(recoveredResult).toEqualTypeOf<
					AsyncResult<number, Error>
				>();
				Result.assertOk(await recoveredResult);
				expect(spy).not.toHaveBeenCalled();
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
		describe("isAsyncResult", () => {
			it("tests whether a value is an async-result", () => {
				const asyncResult = AsyncResult.ok(12);
				expect(asyncResult.isAsyncResult).toBe(true);
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

				await expect(() => result.getOrThrow()).rejects.toThrow(
					/Expected a value, but got an error instead/i,
				);
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
