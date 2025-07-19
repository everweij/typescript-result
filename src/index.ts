export { assertUnreachable } from "./helpers.js";

import {
	type AsyncResult,
	type IfGeneratorAsync,
	type InferGeneratorError,
	type InferGeneratorReturn,
	type Result as ResultBase,
	ResultFactory,
} from "./result.js";

export { NonExhaustiveError } from "./matcher.js";
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

type Ok<Value> = [Value] extends [never] ? never : Result.Ok<Value>;
type Error<Err> = [Err] extends [never] ? never : Result.Error<Err>;

export type Result<Value, Err> = Ok<Value> | Error<Err>;

export const Result: typeof ResultFactory = ResultFactory;
