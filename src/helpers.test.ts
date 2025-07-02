import { describe, expect, expectTypeOf, it } from "vitest";
import type { IsAsyncFunction, IsFunction } from "./helpers.js";
import {
	assertUnreachable,
	isAsyncFn,
	isFunction,
	isPromise,
} from "./helpers.js";

describe("helpers", () => {
	describe("isPromise", () => {
		it("tells whether a value represents a promise", () => {
			expect(isPromise({})).toBe(false);
			expect(isPromise(null)).toBe(false);
			expect(isPromise(undefined)).toBe(false);
			expect(isPromise(Promise.resolve(12))).toBe(true);
			// biome-ignore lint/suspicious/noThenProperty: ignore for testing
			expect(isPromise({ then: () => {} })).toBe(true);
		});
	});

	describe("isFunction", () => {
		it("tells whether a value represents a function", () => {
			expect(isFunction(() => {})).toBe(true);
			expect(isFunction(async () => {})).toBe(true);
			expect(isFunction({})).toBe(false);
		});
	});

	describe("isAsyncFn", () => {
		it("tells whether a value represents an async function", () => {
			expect(isAsyncFn(() => {})).toBe(false);
			expect(isAsyncFn(() => Promise.resolve(12))).toBe(false);
			expect(isAsyncFn(async () => {})).toBe(true);
		});
	});

	describe("assertUnreachable", () => {
		it("throws an error when called", () => {
			// @ts-expect-error
			expect(() => assertUnreachable("")).toThrowError("Unreachable case: ");
		});

		it("complains (TS) when not all cases are handles", () => {
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
		it("tells whether a type represents an async function", () => {
			expectTypeOf<IsAsyncFunction<() => number>>().toEqualTypeOf<false>();
			expectTypeOf<
				IsAsyncFunction<() => Promise<void>>
			>().toEqualTypeOf<true>();
		});
	});

	describe("IsFunction", () => {
		it("tells whether a type represents a function", () => {
			expectTypeOf<IsFunction<() => number>>().toEqualTypeOf<true>();
			expectTypeOf<IsFunction<() => Promise<void>>>().toEqualTypeOf<true>();
			expectTypeOf<IsFunction<{ a: 1 }>>().toEqualTypeOf<false>();
		});
	});
});
