export { assertUnreachable } from "./helpers.js";

import {
	type AsyncResult,
	type IfGeneratorAsync,
	type InferGeneratorError,
	type InferGeneratorReturn,
	Result as ResultBase,
} from "./result.js";

export { AsyncResult } from "./result.js";

export namespace Result {
	export type Error<E> = ResultBase<never, E>;
	export type Ok<V> = ResultBase<V, never>;
	export type InferError<T> = T extends AsyncResult<any, infer Error>
		? Error
		: T extends Result<any, infer Error>
			? Error
			: never;
	export type InferValue<T> = T extends AsyncResult<infer Value, any>
		? Value
		: T extends Result<infer Value, any>
			? Value
			: T;
	export type InferResultFromGenerator<T> = T extends Generator | AsyncGenerator
		? IfGeneratorAsync<
				T,
				AsyncResult<InferGeneratorReturn<T>, InferGeneratorError<T>>,
				Result<InferGeneratorReturn<T>, InferGeneratorError<T>>
			>
		: never;
}

export type Result<Value, Err> =
	| ([Value] extends [never] ? never : Result.Ok<Value>)
	| ([Err] extends [never] ? never : Result.Error<Err>);

export const Result: {
	ok: typeof ResultBase.ok;
	error: typeof ResultBase.error;
	assertOk: typeof ResultBase.assertOk;
	assertError: typeof ResultBase.assertError;
	isResult: typeof ResultBase.isResult;
	isAsyncResult: typeof ResultBase.isAsyncResult;
	all: typeof ResultBase.all;
	allCatching: typeof ResultBase.allCatching;
	wrap: typeof ResultBase.wrap;
	try: typeof ResultBase.try;
	fromAsync: typeof ResultBase.fromAsync;
	fromAsyncCatching: typeof ResultBase.fromAsyncCatching;
	gen: typeof ResultBase.gen;
	genCatching: typeof ResultBase.genCatching;
	[Symbol.hasInstance]: (instance: unknown) => boolean;
} = {
	ok: ResultBase.ok,
	error: ResultBase.error,
	isResult: ResultBase.isResult,
	isAsyncResult: ResultBase.isAsyncResult,
	all: ResultBase.all,
	allCatching: ResultBase.allCatching,
	wrap: ResultBase.wrap,
	try: ResultBase.try,
	fromAsync: ResultBase.fromAsync,
	fromAsyncCatching: ResultBase.fromAsyncCatching,
	gen: ResultBase.gen,
	genCatching: ResultBase.genCatching,
	assertOk: ResultBase.assertOk,
	assertError: ResultBase.assertError,
	[Symbol.hasInstance](instance: unknown) {
		return instance instanceof ResultBase;
	},
};
