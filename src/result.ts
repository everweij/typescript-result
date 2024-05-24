import type {
	AnyAsyncFunction,
	AnyFunction,
	AnyPromise,
	AnyValue,
	InferPromise,
	ListContainsFunction,
	ListContainsPromise,
	ListContainsPromiseOrAsyncFunction,
	NativeError,
	Union,
	UnionContainsPromise,
	Unwrap,
	UnwrapList,
} from "./helpers.js";
import { isAsyncFn, isFunction, isPromise } from "./helpers.js";

type InferError<T> = T extends Result<any, infer Error> ? Error : never;
type InferValue<T> = T extends Result<infer Value, any> ? Value : T;

type InferErrors<Items extends any[]> = {
	[Index in keyof Items]: InferError<Items[Index]>;
};
type InferValues<Items extends any[]> = {
	[Index in keyof Items]: InferValue<Items[Index]>;
};

type AnyResult = Result<any, any>;
type AnyAsyncResult = AsyncResult<any, any>;

type ValueOr<Value, Err, Or> = [Err] extends [never]
	? [Value] extends [never]
		? Or
		: Value
	: Value | Or;

type ErrorOr<Value, Err, Or> = [Value] extends [never]
	? [Err] extends [never]
		? Or
		: Err
	: Err | Or;

type AccountForFunctionThrowing<Items extends any[]> =
	ListContainsFunction<Items> extends true
		? NativeError
		: ListContainsPromise<Items> extends true
			? NativeError
			: never;

export class AsyncResult<Value, Err> extends Promise<Result<Value, Err>> {
	get isAsyncResult(): true {
		return true;
	}

	async errorOrNull(): Promise<ErrorOr<Value, Err, null>> {
		const result = await this;
		return result.errorOrNull();
	}

	async getOrNull(): Promise<ValueOr<Value, Err, null>> {
		const result = await this;
		return result.getOrNull();
	}

	async getOrDefault<Else>(defaultValue: Value | Else): Promise<Value | Else> {
		const result = await this;
		return result.getOrDefault(defaultValue);
	}

	async getOrElse<Else>(onFailure: (error: Err) => Else) {
		const result = await this;
		return result.getOrElse(onFailure) as Promise<Value | Unwrap<Else>>;
	}

	async getOrThrow(): Promise<Value> {
		const result = await this;
		return result.getOrThrow();
	}

	async fold<SuccessResult, FailureResult>(
		onSuccess: (value: Value) => SuccessResult,
		onFailure: (error: Err) => FailureResult,
	) {
		const result = await this;
		return result.fold(onSuccess, onFailure) as Promise<
			Unwrap<SuccessResult> | Unwrap<FailureResult>
		>;
	}

	onFailure(action: (error: Err) => void): AsyncResult<Value, Err> {
		return new AsyncResult<Value, Err>((resolve, reject) =>
			this.then(async (result) => {
				try {
					await result.onFailure(action);
					resolve(result);
				} catch (e) {
					reject(e);
				}
			}),
		);
	}

	onSuccess(action: (value: Value) => void): AsyncResult<Value, Err> {
		return new AsyncResult<Value, Err>((resolve, reject) =>
			this.then(async (result) => {
				try {
					await result.onSuccess(action);
					resolve(result);
				} catch (error) {
					reject(error);
				}
			}),
		);
	}

	map<ReturnType>(transform: (value: Value) => ReturnType) {
		return new AsyncResult<any, any>((resolve, reject) =>
			this.then((result) => {
				if (result.isOk()) {
					try {
						const returnValue = transform((result as { value: Value }).value);
						if (isPromise(returnValue)) {
							returnValue
								.then((value) =>
									resolve(Result.isResult(value) ? value : Result.ok(value)),
								)
								.catch(reject);
						} else {
							resolve(
								Result.isResult(returnValue)
									? returnValue
									: Result.ok(returnValue),
							);
						}
					} catch (error) {
						reject(error);
					}
				} else {
					resolve(result);
				}
			}),
		) as ReturnType extends Promise<infer PromiseValue>
			? PromiseValue extends Result<infer ResultValue, infer ResultError>
				? AsyncResult<ResultValue, Err | ResultError>
				: AsyncResult<PromiseValue, Err>
			: ReturnType extends Result<infer ResultValue, infer ResultError>
				? AsyncResult<ResultValue, Err | ResultError>
				: AsyncResult<ReturnType, Err>;
	}

	mapCatching<ReturnType>(transform: (value: Value) => ReturnType) {
		return new AsyncResult<any, any>((resolve) => {
			this.map(transform)
				.then((result: AnyResult) => resolve(result))
				.catch((error: unknown) => resolve(Result.error(error)));
		}) as ReturnType extends Promise<infer PromiseValue>
			? PromiseValue extends Result<infer ResultValue, infer ResultError>
				? AsyncResult<ResultValue, Err | ResultError | NativeError>
				: AsyncResult<PromiseValue, Err | NativeError>
			: ReturnType extends Result<infer ResultValue, infer ResultError>
				? AsyncResult<ResultValue, Err | ResultError | NativeError>
				: AsyncResult<ReturnType, Err | NativeError>;
	}

	recover<ReturnType>(onFailure: (error: Err) => ReturnType) {
		return new AsyncResult((resolve, reject) =>
			this.then(async (result) => {
				try {
					const outcome = await result.recover(onFailure);
					resolve(outcome);
				} catch (error) {
					reject(error);
				}
			}),
		) as ReturnType extends Promise<infer PromiseValue>
			? PromiseValue extends Result<infer ResultValue, infer ResultError>
				? AsyncResult<Value | ResultValue, ResultError>
				: AsyncResult<PromiseValue | Value, never>
			: ReturnType extends Result<infer ResultValue, infer ResultError>
				? AsyncResult<Value | ResultValue, ResultError>
				: AsyncResult<Value | ReturnType, never>;
	}

	recoverCatching<ReturnType>(onFailure: (error: Err) => ReturnType) {
		return new AsyncResult<any, any>((resolve) =>
			this.then((result) => {
				resolve(result.recoverCatching(onFailure));
			}),
		) as ReturnType extends Promise<infer PromiseValue>
			? PromiseValue extends Result<infer ResultValue, infer ResultError>
				? AsyncResult<Value | ResultValue, ResultError | NativeError>
				: AsyncResult<PromiseValue | Value, NativeError>
			: ReturnType extends Result<infer ResultValue, infer ResultError>
				? AsyncResult<Value | ResultValue, ResultError | NativeError>
				: AsyncResult<Value | ReturnType, NativeError>;
	}

	override toString(): string {
		return "AsyncResult";
	}

	static error<Error>(error: Error): AsyncResult<never, Error> {
		return new AsyncResult((resolve) => resolve(Result.error(error)));
	}

	static ok<Value>(value: Value): AsyncResult<Value, never> {
		return new AsyncResult((resolve) => resolve(Result.ok(value)));
	}

	/**
	 * @internal
	 */
	static fromPromise(promise: AnyPromise) {
		return new AsyncResult((resolve, reject) => {
			promise
				.then((value) =>
					resolve(Result.isResult(value) ? value : Result.ok(value)),
				)
				.catch(reject);
		});
	}

	/**
	 * @internal
	 */
	static fromPromiseCatching(
		promise: AnyPromise,
		transform?: (error: unknown) => unknown,
	) {
		return new AsyncResult((resolve) => {
			promise
				.then((value) =>
					resolve(Result.isResult(value) ? value : Result.ok(value)),
				)
				.catch((caughtError) => {
					resolve(Result.error(transform?.(caughtError) ?? caughtError));
				});
		});
	}
}

export class Result<Value, Err> {
	constructor(
		private readonly _value: Value,
		private readonly _error: Err,
	) {}

	get isResult(): true {
		return true;
	}

	get value(): ValueOr<Value, Err, undefined> {
		return this._value as any;
	}

	get error(): ErrorOr<Value, Err, undefined> {
		return this._error as any;
	}

	private get success() {
		return this.error === undefined;
	}

	private get failure() {
		return this.error !== undefined;
	}

	isOk(): this is Result<[Value] extends [never] ? AnyValue : Value, never> {
		return this.success;
	}

	isError(): this is Result<never, [Err] extends [never] ? AnyValue : Err> {
		return this.failure;
	}

	errorOrNull() {
		return (this.failure ? this._error : null) as ErrorOr<Value, Err, null>;
	}

	getOrNull() {
		return (this.success ? this._value : null) as ValueOr<Value, Err, null>;
	}

	getOrDefault<Else>(defaultValue: Else): Value | Else {
		return this.success ? this._value : defaultValue;
	}

	getOrElse<Else>(
		onFailure: (error: Err) => Else,
	): Else extends Promise<infer U> ? Promise<Value | U> : Value | Else {
		if (isAsyncFn(onFailure)) {
			return this.success
				? Promise.resolve(this._value)
				: (onFailure(this._error) as any);
		}

		return this.success ? this._value : (onFailure(this._error) as any);
	}

	getOrThrow(): Value {
		if (this.success) {
			return this._value;
		}

		throw new Error("Expected a value, but got an error instead", {
			cause: this._error,
		});
	}

	fold<SuccessResult, FailureResult>(
		onSuccess: (value: Value) => SuccessResult,
		onFailure: (error: Err) => FailureResult,
	) {
		const isAsync = isAsyncFn(onSuccess) || isAsyncFn(onFailure);

		const outcome = this.success
			? onSuccess(this._value)
			: onFailure(this._error);

		return (
			isAsync && !isPromise(outcome) ? Promise.resolve(outcome) : outcome
		) as UnionContainsPromise<SuccessResult | FailureResult> extends true
			? Promise<Unwrap<SuccessResult> | Unwrap<FailureResult>>
			: SuccessResult | FailureResult;
	}

	onFailure<ReturnValue>(
		action: (error: Err) => ReturnValue,
	): ReturnValue extends AnyPromise ? AsyncResult<Value, Err> : this {
		const isAsync = isAsyncFn(action);

		if (this.failure) {
			const outcome = action(this._error);
			if (isAsync) {
				return new AsyncResult((resolve) => {
					(outcome as AnyPromise).then(() =>
						resolve(Result.error(this._error)),
					);
				}) as any;
			}

			return this as any;
		}

		return isAsync ? AsyncResult.ok(this._value) : (this as any);
	}

	onSuccess(action: (value: Value) => Promise<void>): AsyncResult<Value, Err>;
	onSuccess(action: (value: Value) => void): this;
	onSuccess(action: (value: Value) => unknown): unknown {
		const isAsync = isAsyncFn(action);

		if (this.success) {
			const outcome = action(this._value);
			if (isAsync) {
				return new AsyncResult((resolve) => {
					(outcome as AnyPromise).then(() => resolve(Result.ok(this._value)));
				});
			}

			return this;
		}

		return isAsync ? AsyncResult.error(this._error) : this;
	}

	map<ReturnType>(transform: (value: Value) => ReturnType) {
		return (
			this.success
				? Result.run(() => transform(this._value))
				: isAsyncFn(transform)
					? AsyncResult.error(this._error)
					: this
		) as ReturnType extends Promise<infer PromiseValue>
			? PromiseValue extends Result<infer ResultValue, infer ResultError>
				? AsyncResult<ResultValue, Err | ResultError>
				: AsyncResult<PromiseValue, Err>
			: ReturnType extends Result<infer ResultValue, infer ResultError>
				? Result<ResultValue, Err | ResultError>
				: Result<ReturnType, Err>;
	}

	mapCatching<ReturnType>(transform: (value: Value) => ReturnType) {
		return (
			this.success ? Result.try(() => transform(this._value)) : this
		) as ReturnType extends Promise<infer PromiseValue>
			? PromiseValue extends Result<infer ResultValue, infer ResultError>
				? AsyncResult<ResultValue, Err | ResultError | NativeError>
				: AsyncResult<PromiseValue, Err | NativeError>
			: ReturnType extends Result<infer ResultValue, infer ResultError>
				? Result<ResultValue, Err | ResultError | NativeError>
				: Result<ReturnType, Err | NativeError>;
	}

	recover<ReturnType>(onFailure: (error: Err) => ReturnType) {
		return (
			this.success
				? isAsyncFn(onFailure)
					? AsyncResult.ok(this._value)
					: this
				: Result.run(() => onFailure(this._error))
		) as ReturnType extends Promise<infer PromiseValue>
			? PromiseValue extends Result<infer ResultValue, infer ResultError>
				? AsyncResult<Value | ResultValue, ResultError>
				: AsyncResult<PromiseValue | Value, never>
			: ReturnType extends Result<infer ResultValue, infer ResultError>
				? Result<Value | ResultValue, ResultError>
				: Result<Value | ReturnType, never>;
	}

	recoverCatching<ReturnType>(onFailure: (error: Err) => ReturnType) {
		return (
			this.success
				? isAsyncFn(onFailure)
					? AsyncResult.ok(this._value)
					: this
				: Result.try(() => onFailure(this._error))
		) as ReturnType extends Promise<infer PromiseValue>
			? PromiseValue extends Result<infer ResultValue, infer ResultError>
				? AsyncResult<Value | ResultValue, ResultError | NativeError>
				: AsyncResult<PromiseValue | Value, NativeError>
			: ReturnType extends Result<infer ResultValue, infer ResultError>
				? Result<Value | ResultValue, ResultError | NativeError>
				: Result<Value | ReturnType, NativeError>;
	}

	toString(): string {
		if (this.success) {
			return `Result.ok(${this._value})`;
		}

		return `Result.error(${this.error})`;
	}

	static ok(): Result<void, never>;
	static ok<Value>(value: Value): Result<Value, never>;
	static ok(value?: unknown) {
		return new Result(value, undefined);
	}

	static error<Error>(error: Error): Result<never, Error> {
		return new Result(undefined as never, error);
	}

	static isResult(possibleResult: unknown): possibleResult is AnyResult {
		return possibleResult instanceof Result;
	}

	static isAsyncResult(
		possibleAsyncResult: unknown,
	): possibleAsyncResult is AnyAsyncResult {
		return possibleAsyncResult instanceof AsyncResult;
	}

	private static run(fn: AnyFunction): AnyResult | AnyAsyncResult {
		const returnValue = fn();

		if (isPromise(returnValue)) {
			return AsyncResult.fromPromise(returnValue);
		}

		return Result.isResult(returnValue) ? returnValue : Result.ok(returnValue);
	}

	private static allInternal(
		items: any[],
		opts: { catching: boolean },
	): AnyResult | AnyAsyncResult {
		if (items.length === 0 || (items.length === 1 && items[0] === undefined)) {
			throw new Error("expected at least 1 argument");
		}

		const runner = opts.catching ? Result.try : Result.run;

		const flattened: Array<AnyResult | AnyAsyncResult> = [];

		let isAsync = items.some(isPromise);
		let hasFailure = false;

		for (const item of items) {
			if (isFunction(item)) {
				if (hasFailure) {
					continue;
				}

				const returnValue = runner(item as AnyFunction);

				if (Result.isResult(returnValue) && returnValue.isError()) {
					hasFailure = true;
					if (!isAsync) {
						return returnValue;
					}
				}

				if (Result.isAsyncResult(returnValue)) {
					isAsync = true;
				}

				flattened.push(returnValue);
			} else if (Result.isResult(item)) {
				if (item.isError()) {
					hasFailure = true;
					if (!isAsync) {
						return item;
					}
				}

				flattened.push(item);
			} else if (Result.isAsyncResult(item)) {
				isAsync = true;
				flattened.push(item);
			} else if (isPromise(item)) {
				isAsync = true;

				flattened.push(
					opts.catching
						? AsyncResult.fromPromiseCatching(item)
						: AsyncResult.fromPromise(item),
				);
			} else {
				flattened.push(Result.ok(item));
			}
		}

		if (isAsync) {
			return new AsyncResult((resolve, reject) => {
				const asyncResults: AnyAsyncResult[] = [];
				const asyncIndexes: number[] = [];

				for (let i = 0; i < flattened.length; i++) {
					const item = flattened[i];
					if (Result.isAsyncResult(item)) {
						asyncResults.push(item);
						asyncIndexes.push(i);
					}
				}

				Promise.all(asyncResults)
					.then((resolvedResults) => {
						const merged = [...flattened] as AnyResult[];
						for (let i = 0; i < resolvedResults.length; i++) {
							// biome-ignore lint/style/noNonNullAssertion:
							merged[asyncIndexes[i]!] = resolvedResults[i]!;
						}

						const firstFailedResult = merged.find((resolvedResult) =>
							resolvedResult.isError(),
						);
						if (firstFailedResult) {
							resolve(firstFailedResult);
							return;
						}

						resolve(Result.ok(merged.map((result) => result.getOrNull())));
					})
					.catch((reason) => {
						// note: this should only happen when opts.catching is false
						reject(reason);
					});
			});
		}

		return Result.ok(
			(flattened as AnyResult[]).map((result) => result.getOrNull()),
		);
	}

	static all<
		Item,
		Rest extends any[],
		AllItems extends any[] = [Item, ...Rest],
		Unwrapped extends any[] = UnwrapList<AllItems>,
	>(item: Item, ...rest: Rest) {
		return Result.allInternal([item, ...rest], {
			catching: false,
		}) as ListContainsPromiseOrAsyncFunction<AllItems> extends true
			? AsyncResult<InferValues<Unwrapped>, Union<InferErrors<Unwrapped>>>
			: Result<InferValues<Unwrapped>, Union<InferErrors<Unwrapped>>>;
	}

	static allCatching<
		Item,
		Rest extends any[],
		AllItems extends any[] = [Item, ...Rest],
		Unwrapped extends any[] = UnwrapList<AllItems>,
	>(item: Item, ...rest: Rest) {
		return Result.allInternal([item, ...rest], {
			catching: true,
		}) as ListContainsPromiseOrAsyncFunction<AllItems> extends true
			? AsyncResult<
					InferValues<Unwrapped>,
					Union<InferErrors<Unwrapped>> | AccountForFunctionThrowing<AllItems>
				>
			: Result<
					InferValues<Unwrapped>,
					Union<InferErrors<Unwrapped>> | AccountForFunctionThrowing<AllItems>
				>;
	}

	static wrap<Fn extends AnyAsyncFunction>(
		fn: Fn,
	): (
		...args: Parameters<Fn>
	) => AsyncResult<InferPromise<ReturnType<Fn>>, NativeError>;
	static wrap<Fn extends AnyFunction>(
		fn: Fn,
	): (...args: Parameters<Fn>) => Result<ReturnType<Fn>, NativeError>;
	static wrap(fn: AnyFunction | AnyAsyncFunction): AnyFunction {
		return function wrapped(...args: any[]) {
			return Result.try(() => fn(...args));
		};
	}

	static try<
		Fn extends AnyAsyncFunction<AnyResult>,
		R = InferPromise<ReturnType<Fn>>,
	>(fn: Fn): AsyncResult<InferValue<R>, InferError<R> | NativeError>;
	static try<Fn extends AnyFunction<AnyResult>, R = ReturnType<Fn>>(
		fn: Fn,
	): Result<InferValue<R>, InferError<R> | NativeError>;
	static try<ReturnType extends AnyPromise>(
		fn: () => ReturnType,
	): AsyncResult<InferPromise<ReturnType>, NativeError>;
	static try<ReturnType>(fn: () => ReturnType): Result<ReturnType, NativeError>;
	static try<ReturnType extends AnyPromise, ErrorType extends AnyValue>(
		fn: () => ReturnType,
		transform: (error: unknown) => ErrorType,
	): AsyncResult<InferPromise<ReturnType>, ErrorType>;
	static try<ReturnType, ErrorType extends AnyValue>(
		fn: () => ReturnType,
		transform: (error: unknown) => ErrorType,
	): Result<ReturnType, ErrorType>;
	static try(
		fn: AnyFunction | AnyAsyncFunction,
		transform?: (error: unknown) => any,
	) {
		try {
			const returnValue = fn();

			if (isPromise(returnValue)) {
				return AsyncResult.fromPromiseCatching(returnValue, transform);
			}

			return Result.isResult(returnValue)
				? returnValue
				: Result.ok(returnValue);
		} catch (caughtError: unknown) {
			return Result.error(transform?.(caughtError) ?? caughtError);
		}
	}

	static fromAsync<T extends Promise<AnyAsyncResult>>(
		value: T,
	): T extends Promise<AsyncResult<infer V, infer E>>
		? AsyncResult<V, E>
		: never;
	static fromAsync<T extends Promise<AnyResult>>(
		value: T,
	): T extends Promise<Result<infer V, infer E>> ? AsyncResult<V, E> : never;
	static fromAsync<T extends AnyPromise>(
		value: T,
	): T extends Promise<infer V> ? AsyncResult<V, never> : never;
	static fromAsync(value: unknown): unknown {
		return Result.run(() => value);
	}

	static fromAsyncCatching<T extends Promise<AnyAsyncResult>>(
		value: T,
	): T extends Promise<AsyncResult<infer V, infer E>>
		? AsyncResult<V, E | NativeError>
		: never;
	static fromAsyncCatching<T extends Promise<AnyResult>>(
		value: T,
	): T extends Promise<Result<infer V, infer E>>
		? AsyncResult<V, E | NativeError>
		: never;
	static fromAsyncCatching<T extends AnyPromise>(
		value: T,
	): T extends Promise<infer V> ? AsyncResult<V, NativeError> : never;
	static fromAsyncCatching(value: unknown): unknown {
		return Result.try(() => value);
	}

	static assertOk<Value>(
		result: Result<Value, any>,
	): asserts result is Result<Value, never> {
		if (result.isError()) {
			throw new Error("Expected a successful result, but got an error instead");
		}
	}

	static assertError<Err>(
		result: Result<any, Err>,
	): asserts result is Result<never, Err> {
		if (result.isOk()) {
			throw new Error("Expected a failed result, but got a value instead");
		}
	}
}
