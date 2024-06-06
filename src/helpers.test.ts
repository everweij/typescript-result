import { describe, expect, expectTypeOf, it } from "vitest";
import type {
	InferPromise,
	IsAsyncFunction,
	IsFunction,
	ListContains,
	ListContainsFunction,
	ListContainsPromiseOrAsyncFunction,
	Union,
	UnionContainsPromise,
	UnwrapList,
} from "./helpers.js";
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
			// biome-ignore lint/suspicious/noThenProperty:
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

	describe("ListContains", () => {
		it("tells whether an entry in a list is true", () => {
			expectTypeOf<ListContains<[false, false]>>().toEqualTypeOf<false>();
			expectTypeOf<ListContains<[false, true]>>().toEqualTypeOf<true>();
			expectTypeOf<ListContains<[true, true]>>().toEqualTypeOf<true>();
		});
	});

	describe("ListContainsPromiseOrAsyncFunction", () => {
		it("tells whether a list contains a promise or async function", () => {
			expectTypeOf<
				ListContainsPromiseOrAsyncFunction<[() => void]>
			>().toEqualTypeOf<false>();
			expectTypeOf<
				ListContainsPromiseOrAsyncFunction<[() => Promise<void>, () => void]>
			>().toEqualTypeOf<true>();
			expectTypeOf<
				ListContainsPromiseOrAsyncFunction<[() => Promise<void>]>
			>().toEqualTypeOf<true>();
		});
	});

	describe("ListContainsFunction", () => {
		it("tells whether a list contains a function", () => {
			expectTypeOf<ListContainsFunction<[() => void]>>().toEqualTypeOf<true>();
			expectTypeOf<ListContainsFunction<[1]>>().toEqualTypeOf<false>();
			expectTypeOf<
				ListContainsFunction<[1, () => void]>
			>().toEqualTypeOf<true>();
		});
	});

	describe("Union", () => {
		it("creates a union type from a list", () => {
			expectTypeOf<Union<["a", "b", "c"]>>().toEqualTypeOf<"a" | "b" | "c">();
		});
	});

	describe("UnwrapList", () => {
		it("unwraps a list of types", () => {
			expectTypeOf<
				UnwrapList<[{ a: "a" }, () => { b: "b" }, () => Promise<{ c: "c" }>]>
			>().toEqualTypeOf<[{ a: "a" }, { b: "b" }, { c: "c" }]>();
		});
	});

	describe("InferPromise", () => {
		it("infers the type of a promise", () => {
			expectTypeOf<InferPromise<Promise<{ a: "a" }>>>().toEqualTypeOf<{
				a: "a";
			}>();
		});
	});

	describe("UnionContainsPromise", () => {
		it("tells whether a union contains a promise", () => {
			expectTypeOf<
				UnionContainsPromise<Promise<number> | number>
			>().toEqualTypeOf<true>();
			expectTypeOf<
				UnionContainsPromise<string | number>
			>().toEqualTypeOf<false>();
			expectTypeOf<
				UnionContainsPromise<Promise<number>>
			>().toEqualTypeOf<true>();
		});
	});
});
