import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { AsyncResult, NonExhaustiveError, Result } from "./index.js";
import type { RedundantElseClauseError } from "./matcher.js";
import { CustomError, ErrorA, ErrorB, ErrorC, errorA } from "./test-helpers.js";

describe("Result", () => {
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

		describe("isError", () => {
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
					expectTypeOf(result).toEqualTypeOf<Result<never, ErrorA>>();
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

		describe("discrimination", () => {
			it("Result.ok(undefined) is a success", () => {
				const result = Result.ok(undefined);
				expect(result.ok).toBe(true);
				expect(result.value).toBeUndefined();
			});

			it("Result.ok(null).toTuple() returns [null, null]", () => {
				const result = Result.ok(null);
				const [value, error] = result.toTuple();
				expect(value).toBeNull();
				expect(error).toBeNull();
			});

			it("Result.ok(undefined).toTuple() returns [undefined, null]", () => {
				const result = Result.ok(undefined);
				const [value, error] = result.toTuple();
				expect(value).toBeUndefined();
				expect(error).toBeNull();
			});

			it("Result.error(undefined) should not compile", () => {
				// @ts-expect-error undefined is not assignable to {}
				Result.error(undefined);
			});

			it("Result.error(null) should not compile", () => {
				// @ts-expect-error null is not assignable to {}
				Result.error(null);
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
				// since the error type is 'never', in this case, the value can only be a number
				expectTypeOf(okResult.getOrNull()).toEqualTypeOf<number>();

				const failureResult = Result.error(new CustomError());
				expectTypeOf(failureResult).toEqualTypeOf<Result.Error<CustomError>>();
				// since the value type is 'never', in this case, the value can only be null
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

		describe("onSuccess async rejection", () => {
			it("rejects instead of hanging when async action throws", async () => {
				const result = Result.ok(42) as Result<number, ErrorA>;

				const outcome = result.onSuccess(async () => {
					throw new Error("boom");
				});

				await expect(outcome).rejects.toThrow("boom");
			});
		});

		describe("onFailure async rejection", () => {
			it("rejects instead of hanging when async action throws", async () => {
				const result = Result.error(errorA) as Result<number, ErrorA>;

				const outcome = result.onFailure(async () => {
					throw new Error("boom");
				});

				await expect(outcome).rejects.toThrow("boom");
			});
		});

		describe("map", () => {
			it("maps an encapsulated successful value to a next result using a transform function", () => {
				const result = Result.ok(2);
				const nextResult = result.map((value) => value * 2);
				expectTypeOf(nextResult).toEqualTypeOf<Result.Ok<number>>();
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

			it("skips transform and preserves error on failure", () => {
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
				).toThrow(CustomError);
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

			it("distributes value and error types from async callback returning union of results", async () => {
				const result = Result.ok(2) as Result<number, ErrorA>;

				const nextResult = result.map(async (value) => {
					if (value > 2) return Result.error(new ErrorB());
					if (value > 1) return Result.error(new ErrorC());
					return Result.ok("success");
				});

				expectTypeOf(nextResult).toEqualTypeOf<
					AsyncResult<string, ErrorA | ErrorB | ErrorC>
				>();
			});

			it("cannot resolve the correct type when the returned value is a union of result-like and regular values", async () => {
				// Note: mixed unions of plain values and Result types fall to the catch-all
				// overload, which wraps without unwrapping. Use Result.gen() for complex
				// control flow that mixes plain values and Result returns.
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

				// TypeScript cannot infer the correct type here, because of the mixed return types in the map callback, so it falls back to the catch-all overload that wraps without unwrapping.
				expectTypeOf(runSync(1)).toEqualTypeOf<
					Result.Ok<Result.Error<ErrorB> | "one" | Result.Ok<"two">>
				>();
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

				// runtime unwrapping still works
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

				expect(fn).not.toThrow(CustomError);

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

				expect(fn).toThrow(/boom/);
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

			it("distributes value and error types from async callback returning union of results", async () => {
				const result = Result.ok(2) as Result<number, ErrorA>;

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

				expect(fn).toThrow(/boom/);
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
				).toThrow(ERROR);
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

			it("distributes value and error types from async callback returning union of results", async () => {
				const result = Result.error(new CustomError()) as Result<
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

			it("distributes value and error types from async callback returning union of results", async () => {
				const result = Result.error(new CustomError()) as Result<
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
				).toThrowError(new NonExhaustiveError(err));
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
});

describe("Issue #25: generic wrapper functions", () => {
	it("AsyncResult.map with generic parameters", () => {
		function wrapper<A, E>(fn: () => AsyncResult<A, E>): AsyncResult<A, E> {
			return fn().map((a) => a);
		}

		// V is inferred as A (catch-all overload), preserving the generic parameter
		expectTypeOf(wrapper).returns.toEqualTypeOf<
			AsyncResult<unknown, unknown>
		>();

		const result = wrapper(() => AsyncResult.ok(12));
		expectTypeOf(result).toEqualTypeOf<AsyncResult<number, never>>();
	});

	it("Result.map with generic parameters", () => {
		function wrapper<A, E>(r: Result<A, E>): Result<A, E> {
			const result = r.map((a) => a);
			return result;
		}

		expectTypeOf(wrapper).returns.toEqualTypeOf<Result<unknown, unknown>>();

		const result = wrapper(Result.ok("hello"));
		expectTypeOf(result).toEqualTypeOf<Result<string, never>>();
	});

	it("Result.gen with generic parameters", () => {
		function wrapperA<A, E>(fn: () => Result<A, E>) {
			return Result.gen(function* () {
				const value = yield* fn();
				return value;
			});
		}

		expectTypeOf(wrapperA).returns.toEqualTypeOf<Result<unknown, unknown>>();

		const resultA = wrapperA(() => Result.ok(12));
		expectTypeOf(resultA).toEqualTypeOf<Result<number, never>>();

		const wrapperB = <A, E>(fn: () => AsyncResult<A, E>): AsyncResult<A, E> => {
			return Result.gen(function* () {
				const r = yield* fn();
				return Result.ok(r);
			});
		};

		expectTypeOf(wrapperB).returns.toEqualTypeOf<
			AsyncResult<unknown, unknown>
		>();

		const resultB = wrapperB(() => AsyncResult.ok(12));
		expectTypeOf(resultB).toEqualTypeOf<AsyncResult<number, never>>();
	});

	it("lets you define interfaces when working with generic results", () => {
		class RunnerError extends Error {
			readonly type = "runner-error";
		}

		interface Runner {
			run<A, E>(task: () => AsyncResult<A, E>): AsyncResult<A, E | RunnerError>;
		}

		class RunnerImpl implements Runner {
			run<A, E>(
				task: () => AsyncResult<A, E>,
			): AsyncResult<A, E | RunnerError> {
				return task().mapError((error) =>
					Math.random() > 0.5 ? error : new RunnerError(),
				);
			}
		}

		const runner = new RunnerImpl();

		const result = runner.run(
			() => AsyncResult.ok(12) as AsyncResult<number, ErrorA>,
		);
		expectTypeOf(result).toEqualTypeOf<
			AsyncResult<number, ErrorA | RunnerError>
		>();
	});
});
