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

export type IsAsyncFunction<T> = T extends AnyAsyncFunction ? true : false;

type IsPromiseOrAsyncFunction<T> = T extends AnyAsyncFunction
	? true
	: T extends Promise<any>
		? true
		: false;

export type IsFunction<T> = T extends AnyFunction ? true : false;

type IsPromise<T> = T extends AnyPromise ? true : false;

export type UnionContainsPromise<Union> = AnyPromise extends Union
	? true
	: false;

export type ListContains<Items extends any[]> = Items[number] extends false
	? false
	: true;

export type ListContainsPromiseOrAsyncFunction<T extends any[]> = ListContains<{
	[Index in keyof T]: IsPromiseOrAsyncFunction<T[Index]>;
}>;

export type ListContainsFunction<T extends any[]> = ListContains<{
	[Index in keyof T]: IsFunction<T[Index]>;
}>;

export type ListContainsPromise<T extends any[]> = ListContains<{
	[Index in keyof T]: IsPromise<T[Index]>;
}>;

export type Union<T extends any[]> = T[number];

export type Unwrap<T> = T extends (...args: any[]) => Promise<infer U>
	? U
	: T extends (...args: any[]) => infer U
		? U
		: T extends Promise<infer U>
			? U
			: T;

export type UnwrapList<Items extends any[]> = {
	[Index in keyof Items]: Unwrap<Items[Index]>;
};

export type InferPromise<T> = T extends Promise<infer U> ? U : never;

export type AnyPromise = Promise<any>;

export type AnyFunction<Returning = any> = (...args: any[]) => Returning;
export type AnyAsyncFunction<Returning = any> = (
	...args: any[]
) => Promise<Returning>;

export type NativeError = globalThis.Error;

// biome-ignore lint/complexity/noBannedTypes:
export type AnyValue = {};
