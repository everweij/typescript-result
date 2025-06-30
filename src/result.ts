import type {
	AnyAsyncFunction,
	AnyFunction,
	AnyPromise,
	AnyValue,
	Contains,
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

type InferError<T> = T extends AsyncResult<any, infer Error>
	? Error
	: T extends Result<any, infer Error>
		? Error
		: never;
type InferValue<T> = T extends AsyncResult<infer Value, any>
	? Value
	: T extends Result<infer Value, any>
		? Value
		: T;

type InferErrors<Items extends any[]> = {
	[Index in keyof Items]: InferError<Items[Index]>;
};
type InferValues<Items extends any[]> = {
	[Index in keyof Items]: InferValue<Items[Index]>;
};

type AnyResult = Result<any, any>;
type AnyAsyncResult = AsyncResult<any, any>;

type ReturningValue<T> =
	| Result<T, any>
	| AsyncResult<T, any>
	| Promise<ReturningValue<T>>
	| T;

type ReturningError<T> =
	| Result<any, T>
	| AsyncResult<any, T>
	| Promise<ReturningError<T>>;

type ExtractValue<T> = T extends ReturningValue<infer Value> ? Value : never;
type ExtractError<T> = T extends ReturningError<infer Error> ? Error : never;

type IfReturnsAsync<T, Yes, No> = Contains<
	T,
	AnyAsyncResult | AnyPromise
> extends true
	? Yes
	: No;

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

export namespace Result {
	export type Error<E> = Result<never, E>;
	export type Ok<V> = Result<V, never>;
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
}

/**
 * Represents the asynchronous outcome of an operation that can either succeed or fail.
 */
export class AsyncResult<Value, Err> extends Promise<Result<Value, Err>> {
	/**
	 * Utility getter to infer the value type of the result.
	 * Note: this getter does not hold any value, it's only used for type inference.
	 */
	declare $inferValue: Value;

	/**
	 * Utility getter to infer the error type of the result.
	 * Note: this getter does not hold any value, it's only used for type inference.
	 */
	declare $inferError: Err;

	/**
	 * Utility getter to check if the current instance is an `AsyncResult`.
	 */
	get isAsyncResult(): true {
		return true;
	}

	/**
	 * @returns the result in a tuple format where the first element is the value and the second element is the error.
	 * If the result is successful, the error will be `null`. If the result is a failure, the value will be `null`.
	 *
	 * This method is especially useful when you want to destructure the result into a tuple and use TypeScript's narrowing capabilities.
	 *
	 * @example Narrowing down the result type using destructuring
	 * ```ts
	 * declare const result: AsyncResult<number, ErrorA>;
	 *
	 * const [value, error] = await result.toTuple();
	 *
	 * if (error) {
	 *   // error is ErrorA
	 *   return;
	 * }
	 *
	 * // value must be a number
	 * ```
	 */
	async toTuple(): Promise<
		[Err] extends [never]
			? [value: Value, error: never]
			: [Value] extends [never]
				? [value: never, error: Err]
				: [value: Value, error: null] | [value: null, error: Err]
	> {
		const result = await this;
		return result.toTuple();
	}

	/**
	 * @returns the encapsulated error if the result is a failure, otherwise `null`.
	 */
	async errorOrNull(): Promise<ErrorOr<Value, Err, null>> {
		const result = (await this) as Result<Value, Err>;
		return result.errorOrNull();
	}

	/**
	 * @returns the encapsulated value if the result is successful, otherwise `null`.
	 */
	async getOrNull(): Promise<ValueOr<Value, Err, null>> {
		const result = (await this) as Result<Value, Err>;
		return result.getOrNull();
	}

	/**
	 * Retrieves the encapsulated value of the result, or a default value if the result is a failure.
	 *
	 * @param defaultValue The value to return if the result is a failure.
	 *
	 * @returns The encapsulated value if the result is successful, otherwise the default value.
	 *
	 * @example
	 * obtaining the value of a result, or a default value
	 * ```ts
	 * declare const result: AsyncResult<number, Error>;
	 *
	 * const value = await result.getOrDefault(0); // number
	 * ```
	 *
	 * @example
	 * using a different type for the default value
	 * ```ts
	 * declare const result: AsyncResult<number, Error>;
	 *
	 * const value = await result.getOrDefault("default"); // number | string
	 * ```
	 */
	async getOrDefault<Else>(defaultValue: Value | Else): Promise<Value | Else> {
		const result = (await this) as Result<Value, Err>;
		return result.getOrDefault(defaultValue);
	}

	/**
	 * Retrieves the value of the result, or transforms the error using the {@link onFailure} callback into a value.
	 *
	 * @param onFailure callback function which allows you to transform the error into a value. The callback can be async as well.
	 * @returns either the value if the result is successful, or the transformed error.
	 *
	 * @example
	 * transforming the error into a value
	 * ```ts
	 * declare const result: AsyncResult<number, Error>;
	 *
	 * const value = await result.getOrElse((error) => 0); // number
	 * ```
	 *
	 * @example
	 * using an async callback
	 * ```ts
	 * const value = await result.getOrElse(async (error) => 0); // number
	 * ```
	 */
	async getOrElse<This extends AnyAsyncResult, Else>(
		this: This,
		onFailure: (error: InferError<This>) => Else,
	) {
		const result = (await this) as Result<Value, InferError<This>>;
		return result.getOrElse(onFailure) as Promise<
			InferValue<This> | Unwrap<Else>
		>;
	}

	/**
	 * Retrieves the encapsulated value of the result, or throws an error if the result is a failure.
	 *
	 * @returns The encapsulated value if the result is successful.
	 *
	 * @throws the encapsulated error if the result is a failure.
	 *
	 * @example
	 * obtaining the value of a result, or throwing an error
	 * ```ts
	 * declare const result: AsyncResult<number, Error>;
	 *
	 * const value = await result.getOrThrow(); // number
	 * ```
	 */
	async getOrThrow(): Promise<Value> {
		const result = (await this) as Result<Value, Err>;
		return result.getOrThrow();
	}

	/**
	 * Returns the result of the {@link onSuccess} callback when the result represents success or
	 * the result of the {@link onFailure} callback when the result represents a failure.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown inside the callbacks are not caught, so it is your responsibility
	 * > to handle these exceptions
	 *
	 * @param onSuccess callback function to run when the result is successful. The callback can be async as well.
	 * @param onFailure callback function to run when the result is a failure. The callback can be async as well.
	 * @returns the result of the callback that was executed.
	 *
	 * @example
	 * folding a result to a response-like object
	 *
	 * ```ts
	 * declare const result: AsyncResult<User, NotFoundError | UserDeactivatedError>;
	 *
	 * const response = await result.fold(
	 *   (user) => ({ status: 200, body: user }),
	 *   (error) => {
	 *     switch (error.type) {
	 *       case "not-found":
	 *         return { status: 404, body: "User not found" };
	 *       case "user-deactivated":
	 *         return { status: 403, body: "User is deactivated" };
	 *     }
	 *   }
	 * );
	 * ```
	 */
	async fold<This extends AnyAsyncResult, SuccessResult, FailureResult>(
		this: This,
		onSuccess: (value: InferValue<This>) => SuccessResult,
		onFailure: (error: InferError<This>) => FailureResult,
	) {
		const result = (await this) as Result<InferValue<This>, InferError<This>>;
		return result.fold(onSuccess, onFailure) as Promise<
			Unwrap<SuccessResult> | Unwrap<FailureResult>
		>;
	}

	/**
	 * Calls the {@link action} callback when the result represents a failure. It is meant to be used for
	 * side-effects and the operation does not modify the result itself.
	 *
	 * @param action callback function to run when the result is a failure. The callback can be async as well.
	 * @returns the original instance of the result.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown inside the {@link action} callback are not caught, so it is your responsibility
	 * > to handle these exceptions
	 *
	 * @example
	 * adding logging between operations
	 * ```ts
	 * declare const result: AsyncResult<number, Error>;
	 *
	 * result
	 *   .onFailure((error) => console.error("I'm failing!", error))
	 *   .map((value) => value * 2); // proceed with other operations
	 * ```
	 */
	onFailure<This extends AnyAsyncResult>(
		this: This,
		action: (error: InferError<This>) => void | Promise<void>,
	): AsyncResult<InferValue<This>, InferError<This>> {
		return new AsyncResult<InferValue<This>, InferError<This>>(
			(resolve, reject) =>
				this.then(async (result) => {
					try {
						if (result.isError()) {
							await action(result.error as InferError<This>);
						}
						resolve(result);
					} catch (e) {
						reject(e);
					}
				}).catch(reject),
		);
	}

	/**
	 * Calls the {@link action} callback when the result represents a success. It is meant to be used for
	 * side-effects and the operation does not modify the result itself.
	 *
	 * @param action callback function to run when the result is successful. The callback can be async as well.
	 * @returns the original instance of the result.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown inside the {@link action} callback are not caught, so it is your responsibility
	 * > to handle these exceptions
	 *
	 * @example
	 * adding logging between operations
	 * ```ts
	 * declare const result: AsyncResult<number, Error>;
	 *
	 * result
	 *   .onSuccess((value) => console.log("I'm a success!", value))
	 *   .map((value) => value * 2); // proceed with other operations
	 * ```
	 *
	 * @example
	 * using an async callback
	 * ```ts
	 * declare const result: AsyncResultResult<number, Error>;
	 *
	 * const asyncResult = await result.onSuccess(async (value) => someAsyncOperation(value));
	 * ```
	 */
	onSuccess<This extends AnyAsyncResult>(
		this: This,
		action: (value: InferValue<This>) => void | Promise<void>,
	): AsyncResult<InferValue<This>, InferError<This>> {
		return new AsyncResult<InferValue<This>, InferError<This>>(
			(resolve, reject) =>
				this.then(async (result) => {
					try {
						if (result.isOk()) {
							await action(result.value as InferValue<This>);
						}
						resolve(result);
					} catch (error) {
						reject(error);
					}
				}).catch(reject),
		);
	}

	/**
	 * Transforms the value of a successful result using the {@link transform} callback.
	 * The {@link transform} callback can also return other {@link Result} or {@link AsyncResult} instances,
	 * which will be returned as-is (the `Error` types will be merged).
	 * The operation will be ignored if the result represents a failure.
	 *
	 * @param transform callback function to transform the value of the result. The callback can be async as well.
	 * @returns a new {@linkcode AsyncResult} instance with the transformed value
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown inside the {@link transform} callback are not caught, so it is your responsibility
	 * > to handle these exceptions. Please refer to {@linkcode AsyncResult.mapCatching} for a version that catches exceptions
	 * > and encapsulates them in a failed result.
	 *
	 * @example
	 * transforming the value of a result
	 * ```ts
	 * declare const result: AsyncResult<number, Error>;
	 *
	 * const transformed = result.map((value) => value * 2); // AsyncResult<number, Error>
	 * ```
	 *
	 * @example
	 * returning a result instance
	 * ```ts
	 * declare const result: AsyncResult<number, Error>;
	 * declare function multiplyByTwo(value: number): Result<number, Error>;
	 *
	 * const transformed = result.map((value) => multiplyByTwo(value)); // AsyncResult<number, Error>
	 * ```
	 *
	 * @example
	 * doing an async transformation
	 * ```ts
	 * declare const result: AsyncResult<number, Error>;
	 *
	 * const transformed = result.map(async (value) => value * 2); // AsyncResult<number, Error>
	 * ```
	 *
	 * @example
	 * returning an async result instance
	 *
	 * ```ts
	 * declare const result: AsyncResult<number, Error>;
	 * declare function storeValue(value: number): AsyncResult<boolean, Error>;
	 *
	 * const transformed = result.map((value) => storeValue(value)); // AsyncResult<boolean, Error>
	 * ```
	 */
	map<This extends AnyAsyncResult, ReturnType, U = Awaited<ReturnType>>(
		this: This,
		transform: (value: InferValue<This>) => ReturnType,
	) {
		return new AsyncResult<any, any>((resolve, reject) =>
			this.then((result) => {
				if (result.isOk()) {
					try {
						const returnValue = transform(
							(result as { value: InferValue<This> }).value,
						);
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
			}).catch(reject),
		) as [ReturnType] extends [Promise<infer PValue>]
			? PValue extends U
				? AsyncResult<ExtractValue<U>, InferError<This> | ExtractError<U>>
				: never
			: ReturnType extends U
				? AsyncResult<ExtractValue<U>, InferError<This> | ExtractError<U>>
				: never;
	}

	/**
	 * Like {@linkcode AsyncResult.map} it transforms the value of a successful result using the {@link transformValue} callback.
	 * In addition, it catches any exceptions that might be thrown inside the {@link transformValue} callback and encapsulates them
	 * in a failed result.
	 *
	 * @param transformValue callback function to transform the value of the result. The callback can be async as well.
	 * @param transformError callback function to transform any potential caught error while transforming the value.
	 * @returns a new {@linkcode AsyncResult} instance with the transformed value
	 */
	mapCatching<
		This extends AnyAsyncResult,
		ReturnType,
		ErrorType = NativeError,
		U = Awaited<ReturnType>,
	>(
		this: This,
		transformValue: (value: InferValue<This>) => ReturnType,
		transformError?: (error: unknown) => ErrorType,
	) {
		return new AsyncResult<any, any>((resolve, reject) => {
			this.map(transformValue)
				.then((result: AnyResult) => resolve(result))
				.catch((error: unknown) => {
					try {
						resolve(
							Result.error(transformError ? transformError(error) : error),
						);
					} catch (err) {
						reject(err);
					}
				});
		}) as [ReturnType] extends [Promise<infer PValue>]
			? PValue extends U
				? AsyncResult<
						ExtractValue<U>,
						InferError<This> | ExtractError<U> | ErrorType
					>
				: never
			: ReturnType extends U
				? AsyncResult<
						ExtractValue<U>,
						InferError<This> | ExtractError<U> | ErrorType
					>
				: never;
	}

	/**
	 * Transforms the encapsulated error of a failed result using the {@link transform} callback into a new error.
	 * This can be useful for instance to capture similar or related errors and treat them as a single higher-level error type
	 * @param transform callback function to transform the error of the result.
	 * @returns new {@linkcode AsyncResult} instance with the transformed error.
	 *
	 * @example
	 * transforming the error of a result
	 * ```ts
	 * const result = Result.try(() => fetch("https://example.com"))
	 *  .mapCatching((response) => response.json() as Promise<Data>)
	 *  .mapError((error) => new FetchDataError("Failed to fetch data", { cause: error }));
	 * // AsyncResult<Data, FetchDataError>;
	 * ```
	 */
	mapError<This extends AnyAsyncResult, NewError>(
		this: This,
		transform: (error: InferError<This>) => NewError,
	) {
		return new AsyncResult<InferValue<This>, NewError>((resolve, reject) =>
			this.then(async (result) => {
				try {
					resolve(result.mapError(transform));
				} catch (error) {
					reject(error);
				}
			}).catch(reject),
		);
	}

	/**
	 * Transforms a failed result using the {@link onFailure} callback into a successful result. Useful for falling back to
	 * other scenarios when a previous operation fails.
	 * The {@link onFailure} callback can also return other {@link Result} or {@link AsyncResult} instances,
	 * which will be returned as-is.
	 * After a recovery, logically, the result can only be a success. Therefore, the error type is set to `never`, unless
	 * the {@link onFailure} callback returns a result-instance with another error type.
	 *
	 * @param onFailure callback function to transform the error of the result. The callback can be async as well.
	 * @returns a new successful {@linkcode AsyncResult} instance when the result represents a failure, or the original instance
	 * if it represents a success.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown inside the {@link onFailure} callback are not caught, so it is your responsibility
	 * > to handle these exceptions. Please refer to {@linkcode AsyncResult.recoverCatching} for a version that catches exceptions
	 * > and encapsulates them in a failed result.
	 *
	 * @example
	 * transforming the error into a value
	 * Note: Since we recover after trying to persist in the database, we can assume that the `DbError` has been taken care
	 * of and therefore it has been removed from the final result.
	 * ```ts
	 * declare function persistInDB(item: Item): AsyncResult<Item, DbError>;
	 * declare function persistLocally(item: Item): AsyncResult<Item, IOError>;
	 *
	 * persistInDB(item).recover(() => persistLocally(item)); // AsyncResult<Item, IOError>
	 * ```
	 */
	recover<This extends AnyAsyncResult, ReturnType, U = Awaited<ReturnType>>(
		this: This,
		onFailure: (error: InferError<This>) => ReturnType,
	) {
		return new AsyncResult((resolve, reject) =>
			this.then(async (result) => {
				try {
					const outcome = await result.recover(onFailure);
					resolve(outcome as any);
				} catch (error) {
					reject(error);
				}
			}).catch(reject),
		) as [ReturnType] extends [Promise<infer PValue>]
			? PValue extends U
				? AsyncResult<InferValue<This> | ExtractValue<U>, ExtractError<U>>
				: never
			: ReturnType extends U
				? AsyncResult<InferValue<This> | ExtractValue<U>, ExtractError<U>>
				: never;
	}

	/**
	 * Like {@linkcode AsyncResult.recover} it transforms a failed result using the {@link onFailure} callback into a successful result.
	 * In addition, it catches any exceptions that might be thrown inside the {@link onFailure} callback and encapsulates them
	 * in a failed result.
	 *
	 * @param onFailure callback function to transform the error of the result. The callback can be async as well.
	 * @returns a new successful {@linkcode AsyncResult} instance when the result represents a failure, or the original instance
	 * if it represents a success.
	 */
	recoverCatching<
		This extends AnyAsyncResult,
		ReturnType,
		U = Awaited<ReturnType>,
	>(this: This, onFailure: (error: InferError<This>) => ReturnType) {
		return new AsyncResult<any, any>((resolve, reject) =>
			this.then((result) => {
				resolve(result.recoverCatching(onFailure));
			}).catch(reject),
		) as [ReturnType] extends [Promise<infer PValue>]
			? PValue extends U
				? AsyncResult<
						InferValue<This> | ExtractValue<U>,
						ExtractError<U> | NativeError
					>
				: never
			: ReturnType extends U
				? AsyncResult<
						InferValue<This> | ExtractValue<U>,
						ExtractError<U> | NativeError
					>
				: never;
	}

	/**
	 * Print-friendly representation of the `AsyncResult` instance.
	 */
	override toString(): string {
		return "AsyncResult";
	}

	/**
	 * @internal
	 */
	static error<Error>(error: Error): AsyncResult<never, Error> {
		return new AsyncResult((resolve) => resolve(Result.error(error)));
	}

	/**
	 * @internal
	 */
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

/**
 * Represents the outcome of an operation that can either succeed or fail.
 */
export class Result<Value, Err> {
	private constructor(
		private readonly _value: Value,
		private readonly _error: Err,
	) {}

	/**
	 * Utility getter to infer the value type of the result.
	 * Note: this getter does not hold any value, it's only used for type inference.
	 */
	declare $inferValue: Value;

	/**
	 * Utility getter to infer the error type of the result.
	 * Note: this getter does not hold any value, it's only used for type inference.
	 */
	declare $inferError: Err;

	/**
	 * Utility getter that checks if the current instance is a `Result`.
	 */
	get isResult(): true {
		return true;
	}

	/**
	 * Retrieves the encapsulated value of the result.
	 *
	 * @returns The value if the operation was successful, otherwise `undefined`.
	 *
	 * __Note:__ You can use {@linkcode Result.isOk} to narrow down the type to a successful result.
	 *
	 * @example
	 * obtaining the value of a result, without checking if it's successful
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * result.value; // number | undefined
	 * ```
	 *
	 * @example
	 * obtaining the value of a result, after checking for success
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * if (result.isOk()) {
	 *   result.value; // number
	 * }
	 * ```
	 */
	get value(): ValueOr<Value, Err, undefined> {
		return this._value as any;
	}

	/**
	 * Retrieves the encapsulated error of the result.
	 *
	 * @returns The error if the operation failed, otherwise `undefined`.
	 *
	 * > [!NOTE]
	 * > You can use {@linkcode Result.isError} to narrow down the type to a failed result.
	 *
	 * @example
	 * obtaining the value of a result, without checking if it's a failure
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * result.error; // Error | undefined
	 * ```
	 *
	 * @example
	 * obtaining the error of a result, after checking for failure
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * if (result.isError()) {
	 *   result.error; // Error
	 * }
	 * ```
	 */
	get error(): ErrorOr<Value, Err, undefined> {
		return this._error as any;
	}

	private get success() {
		return this.error === undefined;
	}

	private get failure() {
		return this.error !== undefined;
	}

	/**
	 * Type guard that checks whether the result is successful.
	 *
	 * @returns `true` if the result is successful, otherwise `false`.
	 *
	 * @example
	 * checking if a result is successful
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * if (result.isOk()) {
	 * 	 result.value; // number
	 * }
	 * ```
	 */
	isOk(): this is Result<[Value] extends [never] ? AnyValue : Value, never> {
		return this.success;
	}

	/**
	 * Type guard that checks whether the result is successful.
	 *
	 * @returns `true` if the result represents a failure, otherwise `false`.
	 *
	 * @example
	 * checking if a result represents a failure
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * if (result.isError()) {
	 * 	 result.error; // Error
	 * }
	 * ```
	 */
	isError(): this is Result<never, [Err] extends [never] ? AnyValue : Err> {
		return this.failure;
	}

	/**
	 * @returns the result in a tuple format where the first element is the value and the second element is the error.
	 * If the result is successful, the error will be `null`. If the result is a failure, the value will be `null`.
	 *
	 * This method is especially useful when you want to destructure the result into a tuple and use TypeScript's narrowing capabilities.
	 *
	 * @example Narrowing down the result type using destructuring
	 * ```ts
	 * declare const result: Result<number, ErrorA>;
	 *
	 * const [value, error] = result.toTuple();
	 *
	 * if (error) {
	 *   // error is ErrorA
	 *   return;
	 * }
	 *
	 * // value must be a number
	 * ```
	 */
	toTuple() {
		return [this._value ?? null, this._error ?? null] as [Err] extends [never]
			? [value: Value, error: never]
			: [Value] extends [never]
				? [value: never, error: Err]
				: [value: Value, error: null] | [value: null, error: Err];
	}

	/**
	 * @returns the encapsulated error if the result is a failure, otherwise `null`.
	 */
	errorOrNull() {
		return (this.failure ? this._error : null) as ErrorOr<Value, Err, null>;
	}

	/**
	 * @returns the encapsulated value if the result is successful, otherwise `null`.
	 */
	getOrNull() {
		return (this.success ? this._value : null) as ValueOr<Value, Err, null>;
	}

	/**
	 * Retrieves the value of the result, or a default value if the result is a failure.
	 *
	 * @param defaultValue The value to return if the result is a failure.
	 *
	 * @returns The encapsulated value if the result is successful, otherwise the default value.
	 *
	 * @example
	 * obtaining the value of a result, or a default value
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * const value = result.getOrDefault(0); // number
	 * ```
	 *
	 * @example
	 * using a different type for the default value
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * const value = result.getOrDefault("default"); // number | string
	 * ```
	 */
	getOrDefault<Else>(defaultValue: Else): Value | Else {
		return this.success ? this._value : defaultValue;
	}

	/**
	 * Retrieves the value of the result, or transforms the error using the {@link onFailure} callback into a value.
	 *
	 * @param onFailure callback function which allows you to transform the error into a value. The callback can be async as well.
	 * @returns either the value if the result is successful, or the transformed error.
	 *
	 * @example
	 * transforming the error into a value
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * const value = result.getOrElse((error) => 0); // number
	 * ```
	 *
	 * @example
	 * using an async callback
	 * ```ts
	 * const value = await result.getOrElse(async (error) => 0); // Promise<number>
	 * ```
	 */
	getOrElse<This extends AnyResult, Else>(
		this: This,
		onFailure: (error: InferError<This>) => Else,
	): Else extends Promise<infer U> ? Promise<Value | U> : Value | Else {
		if (isAsyncFn(onFailure)) {
			return this.success
				? Promise.resolve(this._value)
				: (onFailure(this._error) as any);
		}

		return this.success ? this._value : (onFailure(this._error) as any);
	}

	/**
	 * Retrieves the value of the result, or throws an error if the result is a failure.
	 *
	 * @returns The value if the result is successful.
	 *
	 * @throws the encapsulated error if the result is a failure.
	 *
	 * @example
	 * obtaining the value of a result, or throwing an error
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * const value = result.getOrThrow(); // number
	 * ```
	 */
	getOrThrow(): Value {
		if (this.success) {
			return this._value;
		}

		throw this._error;
	}

	/**
	 * Returns the result of the {@link onSuccess} callback when the result represents success or
	 * the result of the {@link onFailure} callback when the result represents a failure.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown inside the callbacks are not caught, so it is your responsibility
	 * > to handle these exceptions
	 *
	 * @param onSuccess callback function to run when the result is successful. The callback can be async as well.
	 * @param onFailure callback function to run when the result is a failure. The callback can be async as well.
	 * @returns the result of the callback that was executed.
	 *
	 * @example
	 * folding a result to a response-like object
	 *
	 * ```ts
	 * declare const result: Result<User, NotFoundError | UserDeactivatedError>;
	 *
	 * const response = result.fold(
	 *   (user) => ({ status: 200, body: user }),
	 *   (error) => {
	 *     switch (error.type) {
	 *       case "not-found":
	 *         return { status: 404, body: "User not found" };
	 *       case "user-deactivated":
	 *         return { status: 403, body: "User is deactivated" };
	 *     }
	 *   }
	 * );
	 * ```
	 */
	fold<This extends AnyResult, SuccessResult, FailureResult>(
		this: This,
		onSuccess: (value: InferValue<This>) => SuccessResult,
		onFailure: (error: InferError<This>) => FailureResult,
	) {
		const isAsync = isAsyncFn(onSuccess) || isAsyncFn(onFailure);

		const outcome = this.success
			? onSuccess(this._value as InferValue<This>)
			: onFailure(this._error as InferError<This>);

		return (
			isAsync && !isPromise(outcome) ? Promise.resolve(outcome) : outcome
		) as UnionContainsPromise<SuccessResult | FailureResult> extends true
			? Promise<Unwrap<SuccessResult> | Unwrap<FailureResult>>
			: SuccessResult | FailureResult;
	}

	/**
	 * Calls the {@link action} callback when the result represents a failure. It is meant to be used for
	 * side-effects and the operation does not modify the result itself.
	 *
	 * @param action callback function to run when the result is a failure. The callback can be async as well.
	 * @returns the original instance of the result.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown inside the {@link action} callback are not caught, so it is your responsibility
	 * > to handle these exceptions
	 *
	 * @example
	 * adding logging between operations
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * result
	 *   .onFailure((error) => console.error("I'm failing!", error))
	 *   .map((value) => value * 2); // proceed with other operations
	 * ```
	 */
	onFailure<This extends AnyResult, ReturnValue>(
		this: This,
		action: (error: Err) => ReturnValue,
	): ReturnValue extends AnyPromise
		? AsyncResult<InferValue<This>, InferError<This>>
		: Result<InferValue<This>, InferError<This>> {
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

	/**
	 * Calls the {@link action} callback when the result represents a success. It is meant to be used for
	 * side-effects and the operation does not modify the result itself.
	 *
	 * @param action callback function to run when the result is successful. The callback can be async as well.
	 * @returns the original instance of the result. If the callback is async, it returns a new {@link AsyncResult} instance.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown inside the {@link action} callback are not caught, so it is your responsibility
	 * > to handle these exceptions
	 *
	 * @example
	 * adding logging between operations
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * result
	 *   .onSuccess((value) => console.log("I'm a success!", value))
	 *   .map((value) => value * 2); // proceed with other operations
	 * ```
	 *
	 * @example
	 * using an async callback
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * const asyncResult = await result.onSuccess(async (value) => someAsyncOperation(value));
	 * ```
	 */
	onSuccess<This extends AnyResult>(
		this: This,
		action: (value: InferValue<This>) => Promise<void>,
	): AsyncResult<InferValue<This>, InferError<This>>;
	onSuccess<This extends AnyResult>(
		this: This,
		action: (value: InferValue<This>) => void,
	): Result<InferValue<This>, InferError<This>>;
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

	/**
	 * Transforms the value of a successful result using the {@link transform} callback.
	 * The {@link transform} callback can also return other {@link Result} or {@link AsyncResult} instances,
	 * which will be returned as-is (the `Error` types will be merged).
	 * The operation will be ignored if the result represents a failure.
	 *
	 * @param transform callback function to transform the value of the result. The callback can be async as well.
	 * @returns a new {@linkcode Result} instance with the transformed value, or a new {@linkcode AsyncResult} instance
	 * if the transform function is async.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown inside the {@link transform} callback are not caught, so it is your responsibility
	 * > to handle these exceptions. Please refer to {@linkcode Result.mapCatching} for a version that catches exceptions
	 * > and encapsulates them in a failed result.
	 *
	 * @example
	 * transforming the value of a result
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * const transformed = result.map((value) => value * 2); // Result<number, Error>
	 * ```
	 *
	 * @example
	 * returning a result instance
	 * ```ts
	 * declare const result: Result<number, Error>;
	 * declare function multiplyByTwo(value: number): Result<number, Error>;
	 *
	 * const transformed = result.map((value) => multiplyByTwo(value)); // Result<number, Error>
	 * ```
	 *
	 * @example
	 * doing an async transformation
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * const transformed = result.map(async (value) => value * 2); // AsyncResult<number, Error>
	 * ```
	 *
	 * @example
	 * returning an async result instance
	 *
	 * ```ts
	 * declare const result: Result<number, Error>;
	 * declare function storeValue(value: number): AsyncResult<boolean, Error>;
	 *
	 * const transformed = result.map((value) => storeValue(value)); // AsyncResult<boolean, Error>
	 * ```
	 */
	map<This extends AnyResult, ReturnType, U = Awaited<ReturnType>>(
		this: This,
		transform: (value: InferValue<This>) => ReturnType,
	) {
		return (
			this.success
				? Result.run(() => transform(this._value))
				: isAsyncFn(transform)
					? AsyncResult.error(this._error)
					: this
		) as [ReturnType] extends [Promise<infer PValue>]
			? PValue extends U
				? AsyncResult<ExtractValue<U>, InferError<This> | ExtractError<U>>
				: never
			: IfReturnsAsync<
					ReturnType,
					ReturnType extends U
						? AsyncResult<ExtractValue<U>, InferError<This> | ExtractError<U>>
						: never,
					ReturnType extends U
						? Result<ExtractValue<U>, InferError<This> | ExtractError<U>>
						: never
				>;
	}

	/**
	 * Like {@linkcode Result.map} it transforms the value of a successful result using the {@link transformValue} callback.
	 * In addition, it catches any exceptions that might be thrown inside the {@link transformValue} callback and encapsulates them
	 * in a failed result.
	 *
	 * @param transformValue callback function to transform the value of the result. The callback can be async as well.
	 * @param transformError callback function to transform any potential caught error while transforming the value.
	 * @returns a new {@linkcode Result} instance with the transformed value, or a new {@linkcode AsyncResult} instance
	 * if the transform function is async.
	 */
	mapCatching<
		This extends AnyResult,
		ReturnType,
		ErrorType = NativeError,
		U = Awaited<ReturnType>,
	>(
		this: This,
		transformValue: (value: InferValue<This>) => ReturnType,
		transformError?: (err: unknown) => ErrorType,
	) {
		return (
			this.success
				? Result.try(
						() => transformValue(this._value),
						transformError as AnyFunction,
					)
				: this
		) as [ReturnType] extends [Promise<infer PValue>]
			? PValue extends U
				? AsyncResult<
						ExtractValue<U>,
						InferError<This> | ExtractError<U> | ErrorType
					>
				: never
			: IfReturnsAsync<
					ReturnType,
					ReturnType extends U
						? AsyncResult<
								ExtractValue<U>,
								InferError<This> | ExtractError<U> | ErrorType
							>
						: never,
					ReturnType extends U
						? Result<
								ExtractValue<U>,
								InferError<This> | ExtractError<U> | ErrorType
							>
						: never
				>;
	}

	/**
	 * Transforms the encapsulated error of a failed result using the {@link transform} callback into a new error.
	 * This can be useful for instance to capture similar or related errors and treat them as a single higher-level error type
	 * @param transform callback function to transform the error of the result.
	 * @returns new {@linkcode Result} instance with the transformed error.
	 *
	 * @example
	 * transforming the error of a result
	 * ```ts
	 * declare const result: Result<number, ErrorA>;
	 *
	 * result.mapError((error) => new ErrorB(error.message)); // Result<number, ErrorB>
	 * ```
	 */
	mapError<This extends AnyResult, NewError>(
		this: This,
		transform: (error: InferError<This>) => NewError,
	): Result<InferValue<This>, NewError> {
		if (this.success) {
			return this as Result<InferValue<This>, any>;
		}

		return Result.error(transform(this._error));
	}

	/**
	 * Transforms a failed result using the {@link onFailure} callback into a successful result. Useful for falling back to
	 * other scenarios when a previous operation fails.
	 * The {@link onFailure} callback can also return other {@link Result} or {@link AsyncResult} instances,
	 * which will be returned as-is.
	 * After a recovery, logically, the result can only be a success. Therefore, the error type is set to `never`, unless
	 * the {@link onFailure} callback returns a result-instance with another error type.
	 *
	 * @param onFailure callback function to transform the error of the result. The callback can be async as well.
	 * @returns a new successful {@linkcode Result} instance or a new successful {@linkcode AsyncResult} instance
	 * when the result represents a failure, or the original instance if it represents a success.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown inside the {@link onFailure} callback are not caught, so it is your responsibility
	 * > to handle these exceptions. Please refer to {@linkcode Result.recoverCatching} for a version that catches exceptions
	 * > and encapsulates them in a failed result.
	 *
	 * @example
	 * transforming the error into a value
	 * Note: Since we recover after trying to persist in the database, we can assume that the `DbError` has been taken care
	 * of and therefore it has been removed from the final result.
	 * ```ts
	 * declare function persistInDB(item: Item): Result<Item, DbError>;
	 * declare function persistLocally(item: Item): Result<Item, IOError>;
	 *
	 * persistInDB(item).recover(() => persistLocally(item)); // Result<Item, IOError>
	 * ```
	 */
	recover<This extends AnyResult, ReturnType, U = Awaited<ReturnType>>(
		this: This,
		onFailure: (error: InferError<This>) => ReturnType,
	) {
		return (
			this.success
				? isAsyncFn(onFailure)
					? AsyncResult.ok(this._value)
					: this
				: Result.run(() => onFailure(this._error))
		) as [ReturnType] extends [Promise<infer PValue>]
			? PValue extends U
				? AsyncResult<InferValue<This> | ExtractValue<U>, ExtractError<U>>
				: never
			: IfReturnsAsync<
					ReturnType,
					ReturnType extends U
						? AsyncResult<InferValue<This> | ExtractValue<U>, ExtractError<U>>
						: never,
					ReturnType extends U
						? Result<InferValue<This> | ExtractValue<U>, ExtractError<U>>
						: never
				>;
	}

	/**
	 * Like {@linkcode Result.recover} it transforms a failed result using the {@link onFailure} callback into a successful result.
	 * In addition, it catches any exceptions that might be thrown inside the {@link onFailure} callback and encapsulates them
	 * in a failed result.
	 *
	 * @param onFailure callback function to transform the error of the result. The callback can be async as well.
	 * @returns a new successful {@linkcode Result} instance or a new successful {@linkcode AsyncResult} instance
	 * when the result represents a failure, or the original instance if it represents a success.
	 */
	recoverCatching<This extends AnyResult, ReturnType, U = Awaited<ReturnType>>(
		this: This,
		onFailure: (error: InferError<This>) => ReturnType,
	) {
		return (
			this.success
				? isAsyncFn(onFailure)
					? AsyncResult.ok(this._value)
					: this
				: Result.try(() => onFailure(this._error))
		) as [ReturnType] extends [Promise<infer PValue>]
			? PValue extends U
				? AsyncResult<
						InferValue<This> | ExtractValue<U>,
						ExtractError<U> | NativeError
					>
				: never
			: IfReturnsAsync<
					ReturnType,
					ReturnType extends U
						? AsyncResult<
								InferValue<This> | ExtractValue<U>,
								ExtractError<U> | NativeError
							>
						: never,
					ReturnType extends U
						? Result<
								InferValue<This> | ExtractValue<U>,
								ExtractError<U> | NativeError
							>
						: never
				>;
	}

	/**
	 * Returns a string representation of the result.
	 */
	toString(): string {
		if (this.success) {
			return `Result.ok(${this._value})`;
		}

		return `Result.error(${this.error})`;
	}

	/**
	 * Creates a new result instance that represents a successful outcome.
	 *
	 * @param value The value to encapsulate in the result.
	 * @returns a new {@linkcode Result} instance.
	 *
	 * @example
	 * ```ts
	 * const result = Result.ok(42); // Result<number, never>
	 * ```
	 */
	static ok(): Result.Ok<void>;
	static ok<Value>(value: Value): Result.Ok<Value>;
	static ok(value?: unknown) {
		return new Result(value, undefined);
	}

	/**
	 * Creates a new result instance that represents a failed outcome.
	 *
	 * @param error The error to encapsulate in the result.
	 * @returns a new {@linkcode Result} instance.
	 *
	 * @example
	 * ```ts
	 * const result = Result.error(new NotFoundError()); // Result<never, NotFoundError>
	 * ```
	 */
	static error<Error>(error: Error): Result.Error<Error> {
		return new Result(undefined as never, error);
	}

	/**
	 * Type guard that checks whether the provided value is a {@linkcode Result} instance.
	 *
	 * @param possibleResult any value that might be a {@linkcode Result} instance.
	 * @returns true if the provided value is a {@linkcode Result} instance, otherwise false.
	 */
	static isResult(possibleResult: unknown): possibleResult is AnyResult {
		return possibleResult instanceof Result;
	}

	/**
	 * Type guard that checks whether the provided value is a {@linkcode AsyncResult} instance.
	 *
	 * @param possibleAsyncResult any value that might be a {@linkcode AsyncResult} instance.
	 * @returns true if the provided value is a {@linkcode AsyncResult} instance, otherwise false.
	 */
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

	/**
	 * Similar to {@linkcode Promise.all}, but for results.
	 * Useful when you want to run multiple independent operations and bundle the outcome into a single result.
	 * All possible values of the individual operations are collected into an array. `Result.all` will fail eagerly,
	 * meaning that as soon as any of the operations fail, the entire result will be a failure.
	 * Each argument can be a mixture of literal values, functions, {@linkcode Result} or {@linkcode AsyncResult} instances, or {@linkcode Promise}.
	 *
	 * @param items one or multiple literal value, function, {@linkcode Result} or {@linkcode AsyncResult} instance, or {@linkcode Promise}.
	 * @returns combined result of all the operations.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown are not caught, so it is your responsibility
	 * > to handle these exceptions. Please refer to {@linkcode Result.allCatching} for a version that catches exceptions
	 * > and encapsulates them in a failed result.
	 *
	 * @example
	 * basic usage
	 * ```ts
	 * declare function createTask(name: string): Result<Task, IOError>;
	 *
	 * const tasks = ["task-a", "task-b", "task-c"];
	 * const result = Result.all(...tasks.map(createTask)); // Result<Task[], IOError>
	 * ```
	 *
	 * @example
	 * running multiple operations and combining the results
	 * ```ts
	 * const result = Result.all(
	 *   "a",
	 *   Promise.resolve("b"),
	 *   Result.ok("c"),
	 *   Result.try(async () => "d"),
	 *   () => "e",
	 *   () => Result.try(async () => "f"),
	 *   () => Result.ok("g"),
	 *   async () => "h",
	 * ); // AsyncResult<[string, string, string, string, string, string, string, string], Error>
	 * ```
	 */
	static all<Items extends any[], Unwrapped extends any[] = UnwrapList<Items>>(
		...items: Items
	) {
		return Result.allInternal(items, {
			catching: false,
		}) as ListContainsPromiseOrAsyncFunction<Items> extends true
			? AsyncResult<InferValues<Unwrapped>, Union<InferErrors<Unwrapped>>>
			: Result<InferValues<Unwrapped>, Union<InferErrors<Unwrapped>>>;
	}

	/**
	 * Similar to {@linkcode Result.all}, but catches any exceptions that might be thrown during the operations.
	 * @param items one or multiple literal value, function, {@linkcode Result} or {@linkcode AsyncResult} instance, or {@linkcode Promise}.
	 * @returns combined result of all the operations.
	 */
	static allCatching<
		Items extends any[],
		Unwrapped extends any[] = UnwrapList<Items>,
	>(...items: Items) {
		return Result.allInternal(items, {
			catching: true,
		}) as ListContainsPromiseOrAsyncFunction<Items> extends true
			? AsyncResult<
					InferValues<Unwrapped>,
					Union<InferErrors<Unwrapped>> | AccountForFunctionThrowing<Items>
				>
			: Result<
					InferValues<Unwrapped>,
					Union<InferErrors<Unwrapped>> | AccountForFunctionThrowing<Items>
				>;
	}

	/**
	 * Wraps a function and returns a new function that returns a result. Especially useful when you want to work with
	 * external functions that might throw exceptions.
	 * The returned function will catch any exceptions that might be thrown and encapsulate them in a failed result.
	 *
	 * @param fn function to wrap. Can be synchronous or asynchronous.
	 * @returns a new function that returns a result.
	 *
	 * @example
	 * basic usage
	 * ```ts
	 * declare function divide(a: number, b: number): number;
	 *
	 * const safeDivide = Result.wrap(divide);
	 * const result = safeDivide(10, 0); // Result<number, Error>
	 * ```
	 */
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

	/**
	 * Executes the given {@linkcode fn} function and encapsulates the returned value as a successful result, or the
	 * thrown exception as a failed result. In a way, you can view this method as a try-catch block that returns a result.
	 *
	 * @param fn function with code to execute. Can be synchronous or asynchronous.
	 * @param transform optional callback to transform the caught error into a more meaningful error.
	 * @returns a new {@linkcode Result} instance.
	 *
	 * @example
	 * basic usage
	 * ```ts
	 * declare function saveFileToDisk(filename: string): void; // might throw an error
	 *
	 * const result = Result.try(() => saveFileToDisk("file.txt")); // Result<void, Error>
	 * ```
	 *
	 * @example
	 * basic usage with error transformation
	 * ```ts
	 * declare function saveFileToDisk(filename: string): void; // might throw an error
	 *
	 * const result = Result.try(
	 *   () => saveFileToDisk("file.txt"),
	 *   (error) => new IOError("Failed to save file", { cause: error })
	 * ); // Result<void, IOError>
	 * ```
	 */
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

	/**
	 * Utility method to transform an async function to an {@linkcode AsyncResult} instance. Useful when you want to
	 * immediately chain operations after calling an async function/method that returns a Result.
	 *
	 * @param fn the async callback function that returns a literal value or a {@linkcode Result} or {@linkcode AsyncResult} instance.
	 *
	 * @returns a new {@linkcode AsyncResult} instance.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown are not caught, so it is your responsibility
	 * > to handle these exceptions. Please refer to {@linkcode Result.fromAsyncCatching} for a version that catches exceptions
	 * > and encapsulates them in a failed result.
	 *
	 * @example
	 * basic usage
	 *
	 * ```ts
	 * function findUserById(id: string) {
	 *   return Result.fromAsync(async () => {
	 *     const user = await db.query("SELECT * FROM users WHERE id = ?", [id]);
	 *
	 *     if (!user) {
	 *       return Result.error(new NotFoundError("User not found"));
	 *     }
	 *
	 *     return Result.ok(user);
	 *   });
	 * }
	 *
	 * const displayName = await findUserById("123").fold((user) => user.name, () => "Unknown User");
	 * ```
	 */
	static fromAsync<T>(
		fn: () => Promise<T>,
	): AsyncResult<ExtractValue<T>, ExtractError<T>>;
	/**
	 * Utility method to transform a Promise, that holds a literal value or
	 * a {@linkcode Result} or {@linkcode AsyncResult} instance, into an {@linkcode AsyncResult} instance. Useful when you want to immediately chain operations
	 * after calling an async function.
	 *
	 * @param value a Promise that holds a literal value or a {@linkcode Result} or {@linkcode AsyncResult} instance.
	 *
	 * @returns a new {@linkcode AsyncResult} instance.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown are not caught, so it is your responsibility
	 * > to handle these exceptions. Please refer to {@linkcode Result.fromAsyncCatching} for a version that catches exceptions
	 * > and encapsulates them in a failed result.
	 *
	 * @example
	 * basic usage
	 *
	 * ```ts
	 * declare function someAsyncOperation(): Promise<Result<number, Error>>;
	 *
	 * // without 'Result.fromAsync'
	 * const result = (await someAsyncOperation()).map((value) => value * 2); // Result<number, Error>
	 *
	 * // with 'Result.fromAsync'
	 * const asyncResult = Result.fromAsync(someAsyncOperation()).map((value) => value * 2); // AsyncResult<number, Error>
	 * ```
	 */
	static fromAsync<T>(
		value: Promise<T>,
	): AsyncResult<ExtractValue<T>, ExtractError<T>>;
	static fromAsync(valueOrFn: AnyPromise | AnyAsyncFunction) {
		return Result.run(
			typeof valueOrFn === "function" ? valueOrFn : () => valueOrFn,
		);
	}

	/**
	 * Similar to {@linkcode Result.fromAsync} this method transforms an async callback function into an {@linkcode AsyncResult} instance.
	 * In addition, it catches any exceptions that might be thrown during the operation and encapsulates them in a failed result.
	 */
	static fromAsyncCatching<T>(
		fn: () => Promise<T>,
	): AsyncResult<ExtractValue<T>, ExtractError<T> | NativeError>;
	/**
	 * Similar to {@linkcode Result.fromAsync} this method transforms a Promise into an {@linkcode AsyncResult} instance.
	 * In addition, it catches any exceptions that might be thrown during the operation and encapsulates them in a failed result.
	 */
	static fromAsyncCatching<T>(
		value: Promise<T>,
	): AsyncResult<ExtractValue<T>, ExtractError<T> | NativeError>;
	static fromAsyncCatching(valueOrFn: AnyPromise | AnyAsyncFunction) {
		return Result.try(
			typeof valueOrFn === "function" ? valueOrFn : () => valueOrFn,
		);
	}

	/**
	 * Asserts that the provided result is successful. If the result is a failure, an error is thrown.
	 * Useful in unit tests.
	 *
	 * @param result the result instance to assert against.
	 */
	static assertOk<Value>(
		result: Result<Value, any>,
	): asserts result is Result<Value, never> {
		if (result.isError()) {
			throw new Error("Expected a successful result, but got an error instead");
		}
	}

	/**
	 * Asserts that the provided result is a failure. If the result is successful, an error is thrown.
	 * Useful in unit tests.
	 *
	 * @param result the result instance to assert against.
	 */
	static assertError<Err>(
		result: Result<any, Err>,
	): asserts result is Result<never, Err> {
		if (result.isOk()) {
			throw new Error("Expected a failed result, but got a value instead");
		}
	}
}
