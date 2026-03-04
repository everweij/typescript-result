import { describe, expect, expectTypeOf, it } from "vitest";
import type { IsAsyncFunction, IsFunction } from "./helpers.js";
import {
	assertUnreachable,
	isAsyncFn,
	isAsyncGenerator,
	isFunction,
	isGenerator,
	isPromise,
} from "./helpers.js";

describe("helpers", () => {
	describe("isPromise", () => {
		it("returns true for a Promise", () => {
			expect(isPromise(Promise.resolve(12))).toBe(true);
		});

		it("returns true for thenables", () => {
			// biome-ignore lint/suspicious/noThenProperty: ignore for testing
			expect(isPromise({ then: () => {} })).toBe(true);
		});

		it("returns false for non-promise values", () => {
			expect(isPromise({})).toBe(false);
			expect(isPromise(null)).toBe(false);
			expect(isPromise(undefined)).toBe(false);
		});
	});

	describe("isFunction", () => {
		it("returns true for sync and async functions", () => {
			expect(isFunction(() => {})).toBe(true);
			expect(isFunction(async () => {})).toBe(true);
		});

		it("returns false for non-function values", () => {
			expect(isFunction({})).toBe(false);
		});
	});

	describe("isAsyncFn", () => {
		it("returns true for async functions", () => {
			expect(isAsyncFn(async () => {})).toBe(true);
		});

		it("returns false for sync functions", () => {
			expect(isAsyncFn(() => {})).toBe(false);
		});

		it("returns false for sync functions that return a promise", () => {
			expect(isAsyncFn(() => Promise.resolve(12))).toBe(false);
		});

		it("returns false for generator and async generator functions", () => {
			expect(isAsyncFn(function* () {})).toBe(false);
			expect(isAsyncFn(async function* () {})).toBe(false);
		});
	});

	describe("isGenerator", () => {
		it("returns true for a generator object", () => {
			function* gen() {
				yield 1;
			}
			expect(isGenerator(gen())).toBe(true);
		});

		it("returns false for non-generator values", () => {
			expect(isGenerator(null)).toBe(false);
			expect(isGenerator(undefined)).toBe(false);
			expect(isGenerator(42)).toBe(false);
			expect(isGenerator({})).toBe(false);
		});

		it("returns false for a plain object with next/throw/return but missing Symbol.iterator", () => {
			const fake = {
				next: () => ({ value: undefined, done: true }),
				throw: () => ({ value: undefined, done: true }),
				return: () => ({ value: undefined, done: true }),
			};
			expect(isGenerator(fake)).toBe(false);
		});

		it("returns false for an async generator object", () => {
			async function* asyncGen() {
				yield 1;
			}
			expect(isGenerator(asyncGen())).toBe(false);
		});
	});

	describe("isAsyncGenerator", () => {
		it("returns true for an async generator object", () => {
			async function* asyncGen() {
				yield 1;
			}
			expect(isAsyncGenerator(asyncGen())).toBe(true);
		});

		it("returns false for non-async-generator values", () => {
			expect(isAsyncGenerator(null)).toBe(false);
			expect(isAsyncGenerator(undefined)).toBe(false);
			expect(isAsyncGenerator(42)).toBe(false);
			expect(isAsyncGenerator({})).toBe(false);
		});

		it("returns false for a plain object with next/throw/return but missing Symbol.asyncIterator", () => {
			const fake = {
				next: () => ({ value: undefined, done: true }),
				throw: () => ({ value: undefined, done: true }),
				return: () => ({ value: undefined, done: true }),
			};
			expect(isAsyncGenerator(fake)).toBe(false);
		});

		it("returns false for a sync generator object", () => {
			function* gen() {
				yield 1;
			}
			expect(isAsyncGenerator(gen())).toBe(false);
		});
	});

	describe("assertUnreachable", () => {
		it("throws an error including the value when called", () => {
			// @ts-expect-error assertUnreachable expects 'never'
			expect(() => assertUnreachable("oops")).toThrowError(
				"Unreachable case: oops",
			);
		});

		it("complains (TS) when not all cases are handled", () => {
			const value = "a" as "a" | "b";
			switch (value) {
				case "a":
					break;
				default:
					// @ts-expect-error Argument of type is not assignable to parameter of type 'never'
					assertUnreachable(value);
			}
		});
	});

	describe("IsAsyncFunction", () => {
		it("returns true for async function types and false otherwise", () => {
			expectTypeOf<IsAsyncFunction<() => number>>().toEqualTypeOf<false>();
			expectTypeOf<
				IsAsyncFunction<() => Promise<void>>
			>().toEqualTypeOf<true>();
		});
	});

	describe("IsFunction", () => {
		it("returns true for function types and false otherwise", () => {
			expectTypeOf<IsFunction<() => number>>().toEqualTypeOf<true>();
			expectTypeOf<IsFunction<() => Promise<void>>>().toEqualTypeOf<true>();
			expectTypeOf<IsFunction<{ a: 1 }>>().toEqualTypeOf<false>();
		});
	});
});
