import type {
	AnyFunction,
	AnyPromise,
	Contains,
	NativeError,
} from "./helpers.js";
import type { Result as OuterResult } from "./index.js";

export type { OuterResult };

export type InferError<T> = T extends import("./result.js").AsyncResult<
	any,
	infer Error
>
	? Error
	: T extends import("./result.js").Result<any, infer Error>
		? Error
		: never;
export type InferValue<T> = T extends import("./result.js").AsyncResult<
	infer V1,
	any
>
	? V1
	: T extends import("./result.js").Result<infer V2, any>
		? V2
		: T;

export type AnyResult = import("./result.js").Result<any, any>;
export type AnyOuterResult = OuterResult<any, any>;
export type AnyAsyncResult = import("./result.js").AsyncResult<any, any>;

export type ReturningValue<T> =
	| import("./result.js").Result<T, any>
	| import("./result.js").AsyncResult<T, any>
	| Promise<ReturningValue<T>>
	| T;

export type ReturningError<T> =
	| import("./result.js").Result<any, T>
	| import("./result.js").AsyncResult<any, T>
	| Promise<ReturningError<T>>;

export type ExtractValue<T> = T extends ReturningValue<infer Value> ? Value : T;
export type ExtractError<T> =
	T extends ReturningError<infer Error> ? Error : never;

export type ExtractValues<T extends any[]> = {
	[I in keyof T]: T[I] extends Generator | AsyncGenerator
		? InferGeneratorReturn<T[I]>
		: ExtractValue<T[I]>;
};
export type ExtractErrors<T extends any[]> = {
	[I in keyof T]: T[I] extends Generator | AsyncGenerator
		? InferGeneratorError<T[I]>
		: ExtractError<T[I]>;
};

export type ValueOr<Value, Err, Or> = [Err] extends [never]
	? [Value] extends [never]
		? never
		: Value
	: Value | Or;

export type ErrorOr<Value, Err, Or> = [Value] extends [never]
	? [Err] extends [never]
		? never
		: Err
	: Err | Or;

export type SyncOrAsyncGenerator<Y, R, N> =
	| Generator<Y, R, N>
	| AsyncGenerator<Y, R, N>;

export type YieldedError<Y> = Y extends { error: infer E } ? E : never;
export type YieldedAsync<Y> = Y extends { async: infer A } ? A : false;

export type IsGeneratorParamsAsync<Y, RAsync> = [YieldedAsync<Y>] extends [
	false,
]
	? [RAsync] extends [never]
		? false
		: true
	: true;

export type IfGeneratorParamsAsync<Y, RAsync, Yes, No> =
	IsGeneratorParamsAsync<Y, RAsync> extends true ? Yes : No;

export type GenSync<Y, V, E, RAsync> = Generator<
	Y,
	| ReturningValue<V>
	| ReturningError<E>
	| import("./result.js").AsyncResult<RAsync, any>
>;

export type GenAsync<Y, V, E> = AsyncGenerator<
	Y,
	ReturningValue<V> | ReturningError<E>
>;

export type InferGeneratorReturn<T> =
	T extends SyncOrAsyncGenerator<any, infer R, any> ? ExtractValue<R> : never;

export type InferGeneratorError<T> = [T] extends [
	SyncOrAsyncGenerator<never, infer R, any>,
]
	? InferError<R>
	: T extends SyncOrAsyncGenerator<{ error: infer E }, infer R, any>
		? E | InferError<R>
		: never;

type IsGeneratorAsync<T> =
	T extends SyncOrAsyncGenerator<infer Info, infer R, any>
		? Contains<Info, { async: true }> extends true
			? true
			: Contains<T, AsyncGenerator<any, any, any>> extends true
				? true
				: Contains<R, AnyAsyncResult> extends true
					? true
					: false
		: false;

export type IfGeneratorAsync<T, Yes, No> =
	IsGeneratorAsync<T> extends true ? Yes : No;

export type UnwrapList<T extends any[]> = {
	[I in keyof T]: T[I] extends AnyFunction<infer U> ? U : T[I];
};

type IsAsync<T> =
	IsGeneratorAsync<T> extends true
		? true
		: T extends AnyPromise
			? true
			: T extends AnyFunction<infer U>
				? IsAsync<U>
				: never;

export type ListContainsAsync<T extends any[]> = {
	[I in keyof T]: IsAsync<T[I]>;
}[number] extends false
	? false
	: true;

export type AccountForThrowing<T extends any[]> = {
	[I in keyof T]: T[I] extends AnyFunction | AnyPromise ? true : false;
}[number] extends false
	? never
	: NativeError;

export type AccountForThrowingPerPosition<
	Items extends any[],
	Errors extends any[],
> = {
	[I in keyof Items]: Items[I] extends AnyFunction | AnyPromise
		? Errors[I & keyof Errors] | NativeError
		: Errors[I & keyof Errors];
};
