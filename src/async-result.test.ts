import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { AsyncResult, Result } from "./index.js";

class CustomError extends Error {}

class ErrorA extends Error {
	readonly type = "a";
}

class ErrorB extends Error {
	readonly type = "b";
}

class ErrorC extends Error {
	readonly type = "c";
}

const errorA = new ErrorA("some error");

const sleep = () => new Promise((resolve) => setTimeout(resolve, 10));

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

			it("distributes value and error types from async callback returning union of results", async () => {
				const result = AsyncResult.ok(2) as AsyncResult<number, ErrorA>;

				const nextResult = result.map(async (value) => {
					if (value > 2) return Result.error(new ErrorB());
					if (value > 1) return Result.error(new ErrorC());
					return Result.ok("success");
				});

				expectTypeOf(nextResult).toEqualTypeOf<
					AsyncResult<string, ErrorA | ErrorB | ErrorC>
				>();
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

			it("distributes value and error types from async callback returning union of results", async () => {
				const result = AsyncResult.ok(2) as AsyncResult<number, ErrorA>;

				const nextResult = result.mapCatching(async (value) => {
					if (value > 2) return Result.error(new ErrorB());
					if (value > 1) return Result.error(new ErrorC());
					return Result.ok("success");
				});

				expectTypeOf(nextResult).toEqualTypeOf<
					AsyncResult<string, ErrorA | ErrorB | ErrorC | Error>
				>();
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

			it("distributes value and error types from async callback returning union of results", async () => {
				const result = AsyncResult.error(new CustomError()) as AsyncResult<
					number,
					CustomError
				>;

				const nextResult = result.recover(async (_error) => {
					if (_error.message) return Result.error(new ErrorA());
					return Result.ok("recovered");
				});

				expectTypeOf(nextResult).toEqualTypeOf<
					AsyncResult<string | number, ErrorA>
				>();
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

			it("distributes value and error types from async callback returning union of results", async () => {
				const result = AsyncResult.error(new CustomError()) as AsyncResult<
					number,
					CustomError
				>;

				const nextResult = result.recoverCatching(async (_error) => {
					if (_error.message) return Result.error(new ErrorA());
					return Result.ok("recovered");
				});

				expectTypeOf(nextResult).toEqualTypeOf<
					AsyncResult<string | number, ErrorA | Error>
				>();
			});
		});
	});
});
