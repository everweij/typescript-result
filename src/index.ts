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
	type ResultOk<V> = ResultBase<V, never>;
	type ResultError<E> = ResultBase<never, E>;

	export type Ok<Value> = [Value] extends [never] ? never : ResultOk<Value>;
	export type Error<E> = [E] extends [never] ? never : ResultError<E>;
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

export type Result<Value, Err> = Result.Ok<Value> | Result.Error<Err>;

export const Result: typeof ResultFactory = ResultFactory;
