export function isPromise(value: unknown): value is AnyPromise {
	/* c8 ignore next */
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value !== "object") {
		return false;
	}

	return value instanceof Promise || "then" in value;
}

export function isFunction(value: unknown): value is AnyFunction {
	return typeof value === "function";
}

export function isAsyncFn(fn: AnyFunction): fn is AnyAsyncFunction {
	return fn.constructor.name === "AsyncFunction";
}

export function isGenerator(obj: any): obj is Generator {
	return (
		typeof obj === "object" &&
		obj !== null &&
		typeof obj.next === "function" &&
		typeof obj.throw === "function" &&
		typeof obj.return === "function" &&
		typeof obj[Symbol.iterator] === "function" &&
		obj[Symbol.iterator]() === obj
	);
}

export function isAsyncGenerator(obj: any): obj is AsyncGenerator {
	return (
		typeof obj === "object" &&
		obj !== null &&
		typeof obj.next === "function" &&
		typeof obj.throw === "function" &&
		typeof obj.return === "function" &&
		typeof obj[Symbol.asyncIterator] === "function" &&
		obj[Symbol.asyncIterator]() === obj
	);
}

/**
 * Utility function to assert that a case is unreachable
 * @param value the value which to check for exhaustiveness
 *
 * @example
 * ```ts
 * declare const value: "a" | "b" | "c";
 *
 * switch (value) {
 *   case "a":
 * 		// do something
 * 		  break;
 *    case "b":
 * 		// do something
 * 		  break;
 *    default: assertUnreachable(value) // TS should complain here
 * }
 *
 * ```
 */
export function assertUnreachable(value: never): never {
	throw new Error(`Unreachable case: ${value}`);
}

export type IsAsyncFunction<T> = T extends AnyAsyncFunction ? true : false;

export type IsFunction<T> = T extends AnyFunction ? true : false;

export type AnyPromise = Promise<any>;

export type Constructor<T> = abstract new (...args: any[]) => T;

export type AnyFunction<Returning = any> = (...args: any[]) => Returning;
export type AnyAsyncFunction<Returning = any> = (
	...args: any[]
) => Promise<Returning>;

export type NativeError = globalThis.Error;

export type AnyValue = {};

export type Contains<T, V, U = T> = (
	T extends U
		? U extends V
			? true
			: false
		: false
) extends false
	? false
	: true;
