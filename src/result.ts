import type {
	AnyAsyncFunction,
	AnyFunction,
	AnyPromise,
	Contains,
	Defined,
	NativeError,
} from "./helpers.js";
import {
	isAsyncFn,
	isAsyncGenerator,
	isGenerator,
	isPromise,
} from "./helpers.js";
import { Matcher } from "./matcher.js";
import type {
	AnyAsyncResult,
	AnyOuterResult,
	AnyResult,
	ErrorOr,
	IfGeneratorAsync,
	InferError,
	InferGeneratorError,
	InferGeneratorReturn,
	InferValue,
	OuterResult,
	ValueOr,
} from "./types.js";

export type {
	IfGeneratorAsync,
	InferGeneratorError,
	InferGeneratorReturn,
} from "./types.js";

/**
 * Represents the asynchronous outcome of an operation that can either succeed or fail.
 *
 * `AsyncResult` extends `Promise`, so it can be awaited to obtain the underlying {@linkcode Result}.
 * Unlike a raw `Promise`, it exposes chainable methods like {@linkcode AsyncResult.map},
 * {@linkcode AsyncResult.recover}, and {@linkcode AsyncResult.fold} that operate on the eventual
 * result without requiring intermediate `await` calls.
 *
 * `AsyncResult` also supports `yield*` inside generator functions passed to {@linkcode Result.gen},
 * allowing you to short-circuit on errors in an async pipeline.
 */
export class AsyncResult<Value, Err> extends Promise<OuterResult<Value, Err>> {
	/**
	 * @internal
	 */
	constructor(executor: ConstructorParameters<typeof Promise>[0]) {
		super(executor as any);
	}

	/**
	 * Utility getter to infer the value type of the result at the type level.
	 * This getter has no runtime value — it only exists for type inference.
	 *
	 * An alternative is the `Result.InferValue<T>` utility type.
	 *
	 * @example
	 * ```ts
	 * function logValue<T extends AsyncResult<any, any>>(result: T) {
	 *   type Value = T["$inferValue"]; // inferred value type
	 * }
	 * ```
	 */
	declare $inferValue: Value;

	/**
	 * Utility getter to infer the error type of the result at the type level.
	 * This getter has no runtime value — it only exists for type inference.
	 *
	 * An alternative is the `Result.InferError<T>` utility type.
	 *
	 * @example
	 * ```ts
	 * function handleError<T extends AsyncResult<any, any>>(result: T) {
	 *   type Err = T["$inferError"]; // inferred error type
	 * }
	 * ```
	 */
	declare $inferError: Err;

	*[Symbol.iterator](): Generator<{ error: Err; async: true }, Value, any> {
		return yield this as any;
	}

	/**
	 * Always returns `true` on `AsyncResult` instances. Useful for duck-typing checks when the
	 * concrete class is not available (e.g. across package boundaries).
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
	async toTuple<
		This extends AnyAsyncResult,
		V = InferValue<This>,
		E = InferError<This>,
	>(this: This) {
		const result = (await this) as Result<Value, Err>;
		return result.toTuple() as [E] extends [never]
			? [value: V, error: never]
			: [V] extends [never]
				? [value: never, error: E]
				: [value: V, error: null] | [value: null, error: E];
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
			InferValue<This> | (Else extends AnyPromise ? Awaited<Else> : Else)
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
			| (SuccessResult extends AnyPromise
					? Awaited<SuccessResult>
					: SuccessResult)
			| (FailureResult extends AnyPromise
					? Awaited<FailureResult>
					: FailureResult)
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
						if (!result.ok) {
							await action(result.error as InferError<This>);
						}
						resolve(result as OuterResult<InferValue<This>, InferError<This>>);
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
	 * declare const result: AsyncResult<number, Error>;
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
						if (result.ok) {
							await action(result.value as InferValue<This>);
						}
						resolve(result as OuterResult<InferValue<This>, InferError<This>>);
					} catch (error) {
						reject(error);
					}
				}).catch(reject),
		);
	}

	/**
	 * Transforms the value of a successful result using the {@link transform} callback.
	 * The {@link transform} callback can also be a generator function or a function that
	 * returns other {@link Result} or {@link AsyncResult} instances, which will be returned
	 * as-is (the `Error` types will be merged). Conceptually, it is similar to `Array.flatMap`.
	 * This map operation will be ignored if the current result represents a failure.
	 *
	 * This is the async counterpart of {@linkcode Result.map} — it always returns an
	 * {@linkcode AsyncResult} regardless of whether the transform is sync or async.
	 *
	 * @param transform callback function to transform the value of the result. The callback can be async or a generator function as well
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
	 *
	 * @example
	 * using a generator function to transform the value
	 * ```ts
	 * function* doubleValue(value: number) {
	 *   return value * 2;
	 * }
	 *
	 * declare const result: AsyncResult<number, Error>;
	 * const transformed = result.map(doubleValue); // AsyncResult<number, Error>
	 * ```
	 */
	// Dead-end: value is never (only failure possible), map is ignored
	map(
		this: AsyncResult<never, Err>,
		transform: (value: Value) => any,
	): AsyncResult<never, Err>;
	// Generator/AsyncGenerator
	map<This extends AnyAsyncResult, RT extends Generator | AsyncGenerator>(
		this: This,
		transform: (value: InferValue<This>) => RT,
	): AsyncResult<
		InferGeneratorReturn<RT>,
		InferGeneratorError<RT> | InferError<This>
	>;
	// Returns Result<V, E>
	map<This extends AnyAsyncResult, V, E>(
		this: This,
		transform: (value: InferValue<This>) => Result<V, E>,
	): AsyncResult<V, E | InferError<This>>;
	// Returns AsyncResult<V, E>
	map<This extends AnyAsyncResult, V, E>(
		this: This,
		transform: (value: InferValue<This>) => AsyncResult<V, E>,
	): AsyncResult<V, E | InferError<This>>;
	// Returns union of Result/AsyncResult types
	map<This extends AnyAsyncResult, RT extends AnyResult | AnyAsyncResult>(
		this: This,
		transform: (value: InferValue<This>) => RT,
	): AsyncResult<InferValue<RT>, InferError<This> | InferError<RT>>;
	// Returns Promise<Result<V, E> | AsyncResult<V, E>>
	map<This extends AnyAsyncResult, V, E>(
		this: This,
		transform: (
			value: InferValue<This>,
		) => Promise<Result<V, E> | AsyncResult<V, E>>,
	): AsyncResult<V, E | InferError<This>>;
	// Returns Promise<union of Result/AsyncResult types> — distributive fallback
	map<This extends AnyAsyncResult, RT extends AnyResult | AnyAsyncResult>(
		this: This,
		transform: (value: InferValue<This>) => Promise<RT>,
	): AsyncResult<InferValue<RT>, InferError<This> | InferError<RT>>;
	// Returns Promise<V>
	map<This extends AnyAsyncResult, V>(
		this: This,
		transform: (value: InferValue<This>) => Promise<V>,
	): AsyncResult<V, InferError<This>>;
	// Catch-all (plain V) — handles generics and structural overlap
	map<This extends AnyAsyncResult, V>(
		this: This,
		transform: (value: InferValue<This>) => V,
	): AsyncResult<V, InferError<This>>;
	map(this: AnyAsyncResult, transform: (value: any) => any) {
		return new AsyncResult<any, any>((resolve, reject) => {
			this.then(async (result) => resolve(await result.map(transform))).catch(
				reject,
			);
		});
	}

	/**
	 * Like {@linkcode AsyncResult.map}, but catches any exceptions that might be thrown inside the
	 * {@link transformValue} callback and encapsulates them in a failed result.
	 *
	 * @param transformValue callback function to transform the value of the result. The callback can be async or a generator function as well
	 * @param transformError optional callback to transform the caught error. Defaults to `Error` when not provided
	 * @returns a new {@linkcode AsyncResult} instance with the transformed value
	 *
	 * @example Catching a thrown exception during transformation
	 * ```ts
	 * declare const result: AsyncResult<string, never>;
	 *
	 * const parsed = result.mapCatching((json) => JSON.parse(json)); // AsyncResult<any, Error>
	 * ```
	 *
	 * @example Using transformError to provide domain errors
	 * ```ts
	 * declare const result: AsyncResult<string, never>;
	 *
	 * const parsed = result.mapCatching(
	 *   (json) => JSON.parse(json),
	 *   (error) => new ParseError("Invalid JSON", { cause: error }),
	 * ); // AsyncResult<any, ParseError>
	 * ```
	 */
	// Dead-end: value is never (only failure possible), mapCatching is ignored
	mapCatching(
		this: AsyncResult<never, Err>,
		transformValue: (value: Value) => any,
		transformError?: (error: unknown) => any,
	): AsyncResult<never, Err>;
	// Generator/AsyncGenerator
	mapCatching<
		This extends AnyAsyncResult,
		RT extends Generator | AsyncGenerator,
		ErrorType = NativeError,
	>(
		this: This,
		transformValue: (value: InferValue<This>) => RT,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<
		InferGeneratorReturn<RT>,
		InferGeneratorError<RT> | InferError<This> | ErrorType
	>;
	// Returns Result<V, E>
	mapCatching<This extends AnyAsyncResult, V, E, ErrorType = NativeError>(
		this: This,
		transformValue: (value: InferValue<This>) => Result<V, E>,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<V, E | InferError<This> | ErrorType>;
	// Returns AsyncResult<V, E>
	mapCatching<This extends AnyAsyncResult, V, E, ErrorType = NativeError>(
		this: This,
		transformValue: (value: InferValue<This>) => AsyncResult<V, E>,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<V, E | InferError<This> | ErrorType>;
	// Returns union of Result/AsyncResult types
	mapCatching<
		This extends AnyAsyncResult,
		RT extends AnyResult | AnyAsyncResult,
		ErrorType = NativeError,
	>(
		this: This,
		transformValue: (value: InferValue<This>) => RT,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<InferValue<RT>, InferError<This> | InferError<RT> | ErrorType>;
	// Returns Promise<Result<V, E> | AsyncResult<V, E>>
	mapCatching<This extends AnyAsyncResult, V, E, ErrorType = NativeError>(
		this: This,
		transformValue: (
			value: InferValue<This>,
		) => Promise<Result<V, E> | AsyncResult<V, E>>,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<V, E | InferError<This> | ErrorType>;
	// Returns Promise<union of Result/AsyncResult types> — distributive fallback
	mapCatching<
		This extends AnyAsyncResult,
		RT extends AnyResult | AnyAsyncResult,
		ErrorType = NativeError,
	>(
		this: This,
		transformValue: (value: InferValue<This>) => Promise<RT>,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<InferValue<RT>, InferError<This> | InferError<RT> | ErrorType>;
	// Returns Promise<V>
	mapCatching<This extends AnyAsyncResult, V, ErrorType = NativeError>(
		this: This,
		transformValue: (value: InferValue<This>) => Promise<V>,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<V, InferError<This> | ErrorType>;
	// Catch-all (plain V)
	mapCatching<This extends AnyAsyncResult, V, ErrorType = NativeError>(
		this: This,
		transformValue: (value: InferValue<This>) => V,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<V, InferError<This> | ErrorType>;
	mapCatching(
		this: AnyAsyncResult,
		transformValue: (value: any) => any,
		transformError?: (error: unknown) => any,
	) {
		return new AsyncResult<any, any>((resolve, reject) => {
			this.map(transformValue)
				.then((result) => resolve(result as AnyOuterResult))
				.catch((error: unknown) => {
					try {
						resolve(
							createError(transformError ? transformError(error) : error),
						);
					} catch (err) {
						reject(err);
					}
				});
		});
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
					resolve(
						result.mapError(transform) as OuterResult<
							InferValue<This>,
							NewError
						>,
					);
				} catch (error) {
					reject(error);
				}
			}).catch(reject),
		);
	}

	/**
	 * Transforms a failed result using the {@link onFailure} callback into a successful result. Useful for falling back to
	 * other scenarios when a previous operation fails.
	 * The {@link onFailure} callback can also be a generator function or a function that
	 * returns other {@link Result} or {@link AsyncResult} instances, which will be returned as-is (much like Array.flatMap).
	 * After a recovery, logically, the result can only be a success. Therefore, the error type is set to `never`, unless
	 * the {@link onFailure} callback returns a result-instance with another error type.
	 *
	 * @param onFailure callback function to transform the error of the result. The callback can be async or a generator function as well.
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
	// Dead-end: error is never (only success possible), recover is ignored
	recover(
		this: AsyncResult<Value, never>,
		onFailure: (error: Err) => any,
	): AsyncResult<Value, never>;
	// Generator/AsyncGenerator
	recover<This extends AnyAsyncResult, RT extends Generator | AsyncGenerator>(
		this: This,
		onFailure: (error: InferError<This>) => RT,
	): AsyncResult<
		InferGeneratorReturn<RT> | InferValue<This>,
		InferGeneratorError<RT>
	>;
	// Returns Result<V, E>
	recover<This extends AnyAsyncResult, V, E>(
		this: This,
		onFailure: (error: InferError<This>) => Result<V, E>,
	): AsyncResult<V | InferValue<This>, E>;
	// Returns AsyncResult<V, E>
	recover<This extends AnyAsyncResult, V, E>(
		this: This,
		onFailure: (error: InferError<This>) => AsyncResult<V, E>,
	): AsyncResult<V | InferValue<This>, E>;
	// Returns union of Result/AsyncResult types
	recover<This extends AnyAsyncResult, RT extends AnyResult | AnyAsyncResult>(
		this: This,
		onFailure: (error: InferError<This>) => RT,
	): AsyncResult<InferValue<RT> | InferValue<This>, InferError<RT>>;
	// Returns Promise<Result<V, E> | AsyncResult<V, E>>
	recover<This extends AnyAsyncResult, V, E>(
		this: This,
		onFailure: (
			error: InferError<This>,
		) => Promise<Result<V, E> | AsyncResult<V, E>>,
	): AsyncResult<V | InferValue<This>, E>;
	// Returns Promise<union of Result/AsyncResult types> — distributive fallback
	recover<This extends AnyAsyncResult, RT extends AnyResult | AnyAsyncResult>(
		this: This,
		onFailure: (error: InferError<This>) => Promise<RT>,
	): AsyncResult<InferValue<RT> | InferValue<This>, InferError<RT>>;
	// Returns Promise<V>
	recover<This extends AnyAsyncResult, V>(
		this: This,
		onFailure: (error: InferError<This>) => Promise<V>,
	): AsyncResult<V | InferValue<This>, never>;
	// Catch-all (plain V)
	recover<This extends AnyAsyncResult, V>(
		this: This,
		onFailure: (error: InferError<This>) => V,
	): AsyncResult<V | InferValue<This>, never>;
	recover(this: AnyAsyncResult, onFailure: (error: any) => any) {
		return new AsyncResult((resolve, reject) =>
			this.then(async (result) => {
				try {
					const outcome = await result.recover(onFailure);
					resolve(outcome as AnyOuterResult);
				} catch (error) {
					reject(error);
				}
			}).catch(reject),
		);
	}

	/**
	 * Like {@linkcode AsyncResult.recover}, but catches any exceptions that might be thrown inside the
	 * {@link onFailure} callback and encapsulates them in a failed result.
	 *
	 * @param onFailure callback function to transform the error of the result. The callback can be async or a generator function as well
	 * @param transformError optional callback to transform the caught error. Defaults to `Error` when not provided
	 * @returns a new successful {@linkcode AsyncResult} instance when the result represents a failure, or the original instance
	 * if it represents a success
	 *
	 * @example Catching a thrown exception during recovery
	 * ```ts
	 * declare const result: AsyncResult<number, Error>;
	 *
	 * const recovered = result.recoverCatching((error) => {
	 *   if (error.message === "fatal") throw new Error("unrecoverable");
	 *   return 0;
	 * }); // AsyncResult<number, Error>
	 * ```
	 *
	 * @example Using transformError to provide domain errors
	 * ```ts
	 * declare const result: AsyncResult<number, Error>;
	 *
	 * const recovered = result.recoverCatching(
	 *   (error) => { throw new Error("recovery failed"); },
	 *   (error) => new RecoveryError("Could not recover", { cause: error }),
	 * ); // AsyncResult<number, RecoveryError>
	 * ```
	 */
	// Dead-end: error is never (only success possible), recoverCatching is ignored
	recoverCatching(
		this: AsyncResult<Value, never>,
		onFailure: (error: Err) => any,
		transformError?: (error: unknown) => any,
	): AsyncResult<Value, never>;
	// Generator/AsyncGenerator
	recoverCatching<
		This extends AnyAsyncResult,
		RT extends Generator | AsyncGenerator,
		ErrorType = NativeError,
	>(
		this: This,
		onFailure: (error: InferError<This>) => RT,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<
		InferGeneratorReturn<RT> | InferValue<This>,
		InferGeneratorError<RT> | ErrorType
	>;
	// Returns Result<V, E>
	recoverCatching<This extends AnyAsyncResult, V, E, ErrorType = NativeError>(
		this: This,
		onFailure: (error: InferError<This>) => Result<V, E>,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<V | InferValue<This>, E | ErrorType>;
	// Returns AsyncResult<V, E>
	recoverCatching<This extends AnyAsyncResult, V, E, ErrorType = NativeError>(
		this: This,
		onFailure: (error: InferError<This>) => AsyncResult<V, E>,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<V | InferValue<This>, E | ErrorType>;
	// Returns union of Result/AsyncResult types
	recoverCatching<
		This extends AnyAsyncResult,
		RT extends AnyResult | AnyAsyncResult,
		ErrorType = NativeError,
	>(
		this: This,
		onFailure: (error: InferError<This>) => RT,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<InferValue<RT> | InferValue<This>, InferError<RT> | ErrorType>;
	// Returns Promise<Result<V, E> | AsyncResult<V, E>>
	recoverCatching<This extends AnyAsyncResult, V, E, ErrorType = NativeError>(
		this: This,
		onFailure: (
			error: InferError<This>,
		) => Promise<Result<V, E> | AsyncResult<V, E>>,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<V | InferValue<This>, E | ErrorType>;
	// Returns Promise<union of Result/AsyncResult types> — distributive fallback
	recoverCatching<
		This extends AnyAsyncResult,
		RT extends AnyResult | AnyAsyncResult,
		ErrorType = NativeError,
	>(
		this: This,
		onFailure: (error: InferError<This>) => Promise<RT>,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<InferValue<RT> | InferValue<This>, InferError<RT> | ErrorType>;
	// Returns Promise<V>
	recoverCatching<This extends AnyAsyncResult, V, ErrorType = NativeError>(
		this: This,
		onFailure: (error: InferError<This>) => Promise<V>,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<V | InferValue<This>, ErrorType>;
	// Catch-all (plain V)
	recoverCatching<This extends AnyAsyncResult, V, ErrorType = NativeError>(
		this: This,
		onFailure: (error: InferError<This>) => V,
		transformError?: (error: unknown) => ErrorType,
	): AsyncResult<V | InferValue<This>, ErrorType>;
	recoverCatching(
		this: AnyAsyncResult,
		onFailure: (error: any) => any,
		transformError?: (error: unknown) => any,
	) {
		return new AsyncResult<any, any>((resolve, reject) =>
			this.then((result) => {
				resolve(
					result.recoverCatching(onFailure, transformError) as AnyOuterResult,
				);
			}).catch(reject),
		);
	}

	/**
	 * Returns a string representation of the `AsyncResult` instance.
	 *
	 * Unlike {@linkcode Result.toString}, this always returns `"AsyncResult"` because the actual
	 * value is not yet resolved.
	 *
	 * @returns `"AsyncResult"`
	 *
	 * @example
	 * ```ts
	 * const result = Result.fromAsync(Promise.resolve(42));
	 * result.toString(); // "AsyncResult"
	 * ```
	 */
	override toString(): string {
		return "AsyncResult";
	}

	/**
	 * @internal
	 */
	static error<Error extends {}>(error: Error): AsyncResult<never, Error> {
		return new AsyncResult((resolve) =>
			resolve(createError(error) as OuterResult<never, Error>),
		);
	}

	/**
	 * @internal
	 */
	static ok<Value>(value: Value): AsyncResult<Value, never> {
		return new AsyncResult((resolve) =>
			resolve(createOk(value) as OuterResult<Value, never>),
		);
	}

	/**
	 * @internal
	 */
	static fromPromise(promise: AnyPromise) {
		return new AsyncResult((resolve, reject) => {
			promise
				.then((value) =>
					resolve(isResultInstance(value) ? value : createOk(value)),
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
		return new AsyncResult((resolve, reject) => {
			promise
				.then((value) =>
					resolve(isResultInstance(value) ? value : createOk(value)),
				)
				.catch((caughtError) => {
					resolve(createError(transform?.(caughtError) ?? caughtError));
				})
				.catch(reject);
		});
	}
}

/**
 * Represents the outcome of an operation that can either succeed or fail.
 *
 * Use the {@linkcode Result.ok} discriminant property to narrow the result into its success (`Result.Ok<V>`)
 * or failure (`Result.Error<E>`) variant. When narrowed, `value` and `error` are available with their
 * precise types.
 *
 * Instances are created via the static factory methods on the `Result` namespace (e.g.
 * {@linkcode Result.ok}, {@linkcode Result.error}, {@linkcode Result.try}, {@linkcode Result.gen}).
 */
export class Result<Value, Err> {
	constructor(
		private readonly _ok: boolean,
		private readonly _value: Value,
		private readonly _error: Err,
	) {}

	/**
	 * Utility getter to infer the value type of the result at the type level.
	 * This getter has no runtime value — it only exists for type inference.
	 *
	 * An alternative is the `Result.InferValue<T>` utility type.
	 *
	 * @example
	 * ```ts
	 * function logValue<T extends Result<any, any>>(result: T) {
	 *   type Value = T["$inferValue"]; // inferred value type
	 * }
	 * ```
	 */
	declare $inferValue: Value;

	/**
	 * Utility getter to infer the error type of the result at the type level.
	 * This getter has no runtime value — it only exists for type inference.
	 *
	 * An alternative is the `Result.InferError<T>` utility type.
	 *
	 * @example
	 * ```ts
	 * function handleError<T extends Result<any, any>>(result: T) {
	 *   type Err = T["$inferError"]; // inferred error type
	 * }
	 * ```
	 */
	declare $inferError: Err;

	*[Symbol.iterator](): Generator<{ error: Err; async: false }, Value, any> {
		return yield this as any;
	}

	/**
	 * Always returns `true` on `Result` instances. Useful for duck-typing checks when the
	 * concrete class is not available (e.g. across package boundaries).
	 */
	get isResult(): true {
		return true;
	}

	/**
	 * Retrieves the encapsulated value of the result.
	 *
	 * @returns The value if the operation was successful, otherwise `undefined`.
	 *
	 * __Note:__ You can use {@linkcode Result.ok} to narrow down the type to a successful result.
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
	 * if (result.ok) {
	 *   result.value; // number
	 * }
	 * ```
	 */
	get value() {
		return this._value as ValueOr<Value, Err, undefined>;
	}

	/**
	 * Retrieves the encapsulated error of the result.
	 *
	 * @returns The error if the operation failed, otherwise `undefined`.
	 *
	 * > [!NOTE]
	 * > You can use {@linkcode Result.ok} to narrow down the type to a failed result.
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
	 * if (!result.ok) {
	 *   result.error; // Error
	 * }
	 * ```
	 */
	get error() {
		return this._error as ErrorOr<Value, Err, undefined>;
	}

	private get success() {
		return this._ok;
	}

	private get failure() {
		return !this._ok;
	}

	/**
	 * Discriminant property that indicates whether the result represents a success (`true`) or a failure (`false`).
	 * This is the primary way to narrow a `Result` into its `Result.Ok` or `Result.Error` variant.
	 *
	 * When `ok` is `true`, TypeScript narrows the result so that `value` is available and `error` is `undefined`.
	 * When `ok` is `false`, `error` is available and `value` is `undefined`.
	 *
	 * @example Type narrowing with if/else
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * if (result.ok) {
	 *   result.value; // number
	 *   result.error; // undefined
	 * } else {
	 *   result.error; // Error
	 *   result.value; // undefined
	 * }
	 * ```
	 *
	 * @example Early return pattern
	 * ```ts
	 * function handle(result: Result<User, NotFoundError>) {
	 *   if (!result.ok) {
	 *     return result.match()
	 *       .when(NotFoundError, () => "not found")
	 *       .run();
	 *   }
	 *
	 *   return result.value.name; // User
	 * }
	 * ```
	 */
	get ok() {
		return this.success as [Err] extends [never] ? true : false;
	}

	/**
	 * @deprecated use {@linkcode Result.ok} instead.
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
	isOk(): this is [Value] extends [never] ? never : OuterResult.Ok<Value> {
		return this.success;
	}

	/**
	 * @deprecated use {@linkcode Result.ok} instead.
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
	isError(): this is [Err] extends [never] ? never : OuterResult.Error<Err> {
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
	toTuple<T extends AnyResult, V = InferValue<T>, E = InferError<T>>(this: T) {
		return [this._ok ? this._value : null, this._ok ? null : this._error] as [
			E,
		] extends [never]
			? [value: V, error: never]
			: [V] extends [never]
				? [value: never, error: E]
				: [value: V, error: null] | [value: null, error: E];
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
			return (
				this.success ? Promise.resolve(this._value) : onFailure(this._error)
			) as any;
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
		) as Contains<SuccessResult | FailureResult, AnyPromise> extends true
			? Promise<Awaited<SuccessResult> | Awaited<FailureResult>>
			: SuccessResult | FailureResult;
	}

	/**
	 * Allows you to match the errors of a failed result using the returned {@link Matcher} instance.
	 * This method can only be called on a failed result — you must first narrow the result by checking
	 * the {@linkcode Result.ok} property.
	 *
	 * If called without narrowing, TypeScript will return a descriptive string literal type as a compile-time hint
	 * instead of a `Matcher`, guiding you to narrow first.
	 *
	 * Key behaviors:
	 * - **Exhaustive checking**: if you forget to handle an error type, `run()` will produce a compile-time error
	 * - **`else()` fallback**: handles any remaining unmatched errors. Cannot be called if all cases are already covered
	 * - **Multiple types per `when()`**: pass multiple error types to handle them with a single handler
	 * - **Async callbacks**: if any handler is async, `run()` returns a Promise
	 *
	 * @returns {@link Matcher} instance that can be used to build a chain of matching patterns for the errors of the result
	 *
	 * @example Matching against error classes
	 * ```ts
	 * declare const result: Result<number, NotFoundError | UserDeactivatedError>;
	 *
	 * if (!result.ok) {
	 *   return result
	 *     .match()
	 *     .when(NotFoundError, (error) => ({ status: 404 }))
	 *     .when(UserDeactivatedError, (error) => ({ status: 403 }))
	 *     .run();
	 * }
	 * ```
	 *
	 * @example Multiple error types in a single handler
	 * ```ts
	 * declare const result: Result<number, ErrorA | ErrorB | ErrorC>;
	 *
	 * if (!result.ok) {
	 *   result
	 *     .match()
	 *     .when(ErrorA, ErrorB, () => console.error("A or B"))
	 *     .when(ErrorC, () => console.error("C"))
	 *     .run();
	 * }
	 * ```
	 *
	 * @example Using else() as a fallback
	 * ```ts
	 * declare const result: Result<number, "not-found" | "forbidden" | "other">;
	 *
	 * if (!result.ok) {
	 *   result
	 *     .match()
	 *     .when("not-found", () => console.error("Not found"))
	 *     .else((error) => console.error("Other error:", error))
	 *     .run();
	 * }
	 * ```
	 */
	match<This extends AnyResult>(this: This) {
		return (this.failure ? new Matcher(this._error) : undefined) as [
			InferValue<This>,
		] extends [never]
			? Matcher<InferError<This>>
			: "'match()' can only be called on a failed result. Please narrow the result by checking the 'ok' property.";
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
	// Error-specific async: preserves Result.Error<Err> display
	onFailure(
		this: Result<never, Err>,
		action: (error: Err) => Promise<any>,
	): AsyncResult<never, Err>;
	// Error-specific sync: preserves Result.Error<Err> display
	onFailure(
		this: Result<never, Err>,
		action: (error: Err) => any,
	): OuterResult.Error<Err>;
	// Ok-specific async: no-op on Ok, preserves Result.Ok<Value> display
	onFailure(
		this: Result<Value, never>,
		action: (error: any) => Promise<any>,
	): AsyncResult<Value, never>;
	// Ok-specific sync: no-op on Ok, preserves Result.Ok<Value> display
	onFailure(
		this: Result<Value, never>,
		action: (error: any) => any,
	): OuterResult.Ok<Value>;
	onFailure<This extends AnyResult>(
		this: This,
		action: (error: InferError<This>) => Promise<any>,
	): AsyncResult<InferValue<This>, InferError<This>>;
	onFailure<This extends AnyResult>(
		this: This,
		action: (error: InferError<This>) => any,
	): OuterResult<InferValue<This>, InferError<This>>;
	onFailure(action: (error: Err) => unknown): unknown {
		if (this.failure) {
			const outcome = action(this._error);
			if (isPromise(outcome)) {
				return new AsyncResult((resolve, reject) => {
					outcome
						.then(() => resolve(createError(this._error as Defined)))
						.catch(reject);
				}) as any;
			}

			return this as any;
		}

		return (isAsyncFn(action) ? AsyncResult.ok(this._value) : this) as any;
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
	// Error-specific async: no-op on Error, preserves Result.Error<Err> display
	onSuccess(
		this: Result<never, Err>,
		action: (value: any) => Promise<void>,
	): AsyncResult<never, Err>;
	// Error-specific sync: no-op on Error, preserves Result.Error<Err> display
	onSuccess(
		this: Result<never, Err>,
		action: (value: any) => void,
	): OuterResult.Error<Err>;
	// Ok-specific async: preserves AsyncResult<Value, never> for async callbacks
	onSuccess(
		this: Result<Value, never>,
		action: (value: Value) => Promise<void>,
	): AsyncResult<Value, never>;
	// Ok-specific sync: preserves Result.Ok<Value> display
	onSuccess(
		this: Result<Value, never>,
		action: (value: Value) => void,
	): OuterResult.Ok<Value>;
	onSuccess<This extends AnyResult>(
		this: This,
		action: (value: InferValue<This>) => Promise<void>,
	): AsyncResult<InferValue<This>, InferError<This>>;
	onSuccess<This extends AnyResult>(
		this: This,
		action: (value: InferValue<This>) => void,
	): OuterResult<InferValue<This>, InferError<This>>;
	onSuccess(action: (value: Value) => unknown): unknown {
		if (this.success) {
			const outcome = action(this._value);
			if (isPromise(outcome)) {
				return new AsyncResult((resolve, reject) => {
					outcome.then(() => resolve(createOk(this._value))).catch(reject);
				});
			}

			return this;
		}

		return isAsyncFn(action) ? AsyncResult.error(this._error as Defined) : this;
	}

	/**
	 * Transforms the value of a successful result using the {@link transform} callback.
	 * The {@link transform} callback can also be a generator function or a function that
	 * returns other {@link Result} or {@link AsyncResult} instances, which will be returned
	 * as-is (the `Error` types will be merged). Conceptually, it is similar to `Array.flatMap`.
	 * This map operation will be ignored if the current result represents a failure.
	 *
	 * When the transform callback is async or returns a Promise/AsyncResult, the result
	 * automatically becomes an {@linkcode AsyncResult}. See {@linkcode AsyncResult.map} for
	 * the async counterpart.
	 *
	 * @param transform callback function to transform the value of the result. The callback can be async or a generator function as well
	 * @returns a new {@linkcode Result} instance with the transformed value, or a new {@linkcode AsyncResult} instance
	 * if the transform function is async
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
	 *
	 * @example
	 * using a generator function to transform the value
	 * ```ts
	 * function* doubleValue(value: number) {
	 *   return value * 2;
	 * }
	 *
	 * declare const result: Result<number, Error>;
	 * const transformed = result.map(doubleValue); // Result<number, Error>
	 * ```
	 */
	// Dead-end: value is never (only failure possible), map is ignored
	map(
		this: Result<never, Err>,
		transform: (value: Value) => any,
	): OuterResult.Error<Err>;
	// Generator/AsyncGenerator
	map<This extends AnyResult, RT extends Generator | AsyncGenerator>(
		this: This,
		transform: (value: InferValue<This>) => RT,
	): IfGeneratorAsync<
		RT,
		AsyncResult<
			InferGeneratorReturn<RT>,
			InferGeneratorError<RT> | InferError<This>
		>,
		OuterResult<
			InferGeneratorReturn<RT>,
			InferGeneratorError<RT> | InferError<This>
		>
	>;
	// Returns Result<V, E>
	map<This extends AnyResult, V, E>(
		this: This,
		transform: (value: InferValue<This>) => Result<V, E>,
	): OuterResult<V, E | InferError<This>>;
	// Returns AsyncResult<V, E>
	map<This extends AnyResult, V, E>(
		this: This,
		transform: (value: InferValue<This>) => AsyncResult<V, E>,
	): AsyncResult<V, E | InferError<This>>;
	// Returns union of Result/AsyncResult types
	map<This extends AnyResult, RT extends AnyResult | AnyAsyncResult>(
		this: This,
		transform: (value: InferValue<This>) => RT,
	): Contains<RT, AnyAsyncResult> extends true
		? AsyncResult<InferValue<RT>, InferError<This> | InferError<RT>>
		: OuterResult<InferValue<RT>, InferError<This> | InferError<RT>>;
	// Returns Promise<Result<V, E> | AsyncResult<V, E>>
	map<This extends AnyResult, V, E>(
		this: This,
		transform: (
			value: InferValue<This>,
		) => Promise<Result<V, E> | AsyncResult<V, E>>,
	): AsyncResult<V, E | InferError<This>>;
	// Returns Promise<union of Result/AsyncResult types> — distributive fallback
	map<This extends AnyResult, RT extends AnyResult | AnyAsyncResult>(
		this: This,
		transform: (value: InferValue<This>) => Promise<RT>,
	): AsyncResult<InferValue<RT>, InferError<This> | InferError<RT>>;
	// Returns Promise<V>
	map<This extends AnyResult, V>(
		this: This,
		transform: (value: InferValue<This>) => Promise<V>,
	): AsyncResult<V, InferError<This>>;
	// Ok-specific: preserves Result.Ok<V> display when this is a pure-Ok result
	map<V>(
		this: Result<Value, never>,
		transform: (value: Value) => V,
	): OuterResult.Ok<V>;
	// Catch-all (plain V) — handles generics and structural overlap
	map<This extends AnyResult, V>(
		this: This,
		transform: (value: InferValue<This>) => V,
	): OuterResult<V, InferError<This>>;
	map(this: AnyResult, transform: (value: any) => any) {
		return this.success
			? run(() => transform(this._value))
			: isAsyncFn(transform)
				? AsyncResult.error(this._error)
				: this;
	}

	/**
	 * Like {@linkcode Result.map}, but catches any exceptions that might be thrown inside the
	 * {@link transformValue} callback and encapsulates them in a failed result.
	 *
	 * @param transformValue callback function to transform the value of the result. The callback can be async or a generator function as well
	 * @param transformError optional callback to transform the caught error. Defaults to `Error` when not provided
	 * @returns a new {@linkcode Result} instance with the transformed value, or a new {@linkcode AsyncResult} instance
	 * if the transform function is async
	 *
	 * @example Catching a thrown exception during transformation
	 * ```ts
	 * declare const result: Result<string, never>;
	 *
	 * const parsed = result.mapCatching((json) => JSON.parse(json)); // Result<any, Error>
	 * ```
	 *
	 * @example Using transformError to provide domain errors
	 * ```ts
	 * declare const result: Result<string, never>;
	 *
	 * const parsed = result.mapCatching(
	 *   (json) => JSON.parse(json),
	 *   (error) => new ParseError("Invalid JSON", { cause: error }),
	 * ); // Result<any, ParseError>
	 * ```
	 */
	// Dead-end: value is never (only failure possible), mapCatching is ignored
	mapCatching(
		this: Result<never, Err>,
		transformValue: (value: Value) => any,
		transformError?: (err: unknown) => any,
	): OuterResult.Error<Err>;
	// Generator/AsyncGenerator
	mapCatching<
		This extends AnyResult,
		RT extends Generator | AsyncGenerator,
		ErrorType = NativeError,
	>(
		this: This,
		transformValue: (value: InferValue<This>) => RT,
		transformError?: (err: unknown) => ErrorType,
	): IfGeneratorAsync<
		RT,
		AsyncResult<
			InferGeneratorReturn<RT>,
			InferGeneratorError<RT> | InferError<This> | ErrorType
		>,
		OuterResult<
			InferGeneratorReturn<RT>,
			InferGeneratorError<RT> | InferError<This> | ErrorType
		>
	>;
	// Returns Result<V, E>
	mapCatching<This extends AnyResult, V, E, ErrorType = NativeError>(
		this: This,
		transformValue: (value: InferValue<This>) => Result<V, E>,
		transformError?: (err: unknown) => ErrorType,
	): OuterResult<V, E | InferError<This> | ErrorType>;
	// Returns AsyncResult<V, E>
	mapCatching<This extends AnyResult, V, E, ErrorType = NativeError>(
		this: This,
		transformValue: (value: InferValue<This>) => AsyncResult<V, E>,
		transformError?: (err: unknown) => ErrorType,
	): AsyncResult<V, E | InferError<This> | ErrorType>;
	// Returns union of Result/AsyncResult types
	mapCatching<
		This extends AnyResult,
		RT extends AnyResult | AnyAsyncResult,
		ErrorType = NativeError,
	>(
		this: This,
		transformValue: (value: InferValue<This>) => RT,
		transformError?: (err: unknown) => ErrorType,
	): Contains<RT, AnyAsyncResult> extends true
		? AsyncResult<InferValue<RT>, InferError<This> | InferError<RT> | ErrorType>
		: OuterResult<
				InferValue<RT>,
				InferError<This> | InferError<RT> | ErrorType
			>;
	// Returns Promise<Result<V, E> | AsyncResult<V, E>>
	mapCatching<This extends AnyResult, V, E, ErrorType = NativeError>(
		this: This,
		transformValue: (
			value: InferValue<This>,
		) => Promise<Result<V, E> | AsyncResult<V, E>>,
		transformError?: (err: unknown) => ErrorType,
	): AsyncResult<V, E | InferError<This> | ErrorType>;
	// Returns Promise<union of Result/AsyncResult types> — distributive fallback
	mapCatching<
		This extends AnyResult,
		RT extends AnyResult | AnyAsyncResult,
		ErrorType = NativeError,
	>(
		this: This,
		transformValue: (value: InferValue<This>) => Promise<RT>,
		transformError?: (err: unknown) => ErrorType,
	): AsyncResult<InferValue<RT>, InferError<This> | InferError<RT> | ErrorType>;
	// Returns Promise<V>
	mapCatching<This extends AnyResult, V, ErrorType = NativeError>(
		this: This,
		transformValue: (value: InferValue<This>) => Promise<V>,
		transformError?: (err: unknown) => ErrorType,
	): AsyncResult<V, InferError<This> | ErrorType>;
	// Catch-all (plain V)
	mapCatching<This extends AnyResult, V, ErrorType = NativeError>(
		this: This,
		transformValue: (value: InferValue<This>) => V,
		transformError?: (err: unknown) => ErrorType,
	): OuterResult<V, InferError<This> | ErrorType>;
	mapCatching(
		this: AnyResult,
		transformValue: (value: any) => any,
		transformError?: (err: unknown) => any,
	): any {
		return this.success
			? tryCatch(
					() => transformValue(this._value),
					transformError as AnyFunction,
				)
			: this;
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
	// Ok-specific: no-op on Ok, preserves Result.Ok<Value> display
	mapError(
		this: Result<Value, never>,
		transform: (error: any) => any,
	): OuterResult.Ok<Value>;
	// Error-specific: preserves Result.Error<NewError> display
	mapError<NewError>(
		this: Result<never, Err>,
		transform: (error: Err) => NewError,
	): OuterResult.Error<NewError>;
	mapError<This extends AnyResult, NewError>(
		this: This,
		transform: (error: InferError<This>) => NewError,
	): OuterResult<InferValue<This>, NewError>;
	mapError(transform: (error: Err) => unknown): unknown {
		if (this.success) {
			return this;
		}

		return createError(transform(this._error) as Defined);
	}

	/**
	 * Transforms a failed result using the {@link onFailure} callback into a successful result. Useful for falling back to
	 * other scenarios when a previous operation fails.
	 * The {@link onFailure} callback can also be a generator function or a function that
	 * returns other {@link Result} or {@link AsyncResult} instances, which will be returned as-is (much like Array.flatMap).
	 * After a recovery, logically, the result can only be a success. Therefore, the error type is set to `never`, unless
	 * the {@link onFailure} callback returns a result-instance with another error type.
	 *
	 * @param onFailure callback function to transform the error of the result. The callback can be async or a generator function as well.
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
	// Dead-end: error is never (only success possible), recover is ignored
	recover(
		this: Result<Value, never>,
		onFailure: (error: Err) => any,
	): OuterResult.Ok<Value>;
	// Generator/AsyncGenerator
	recover<This extends AnyResult, RT extends Generator | AsyncGenerator>(
		this: This,
		onFailure: (error: InferError<This>) => RT,
	): IfGeneratorAsync<
		RT,
		AsyncResult<
			InferGeneratorReturn<RT> | InferValue<This>,
			InferGeneratorError<RT>
		>,
		OuterResult<
			InferGeneratorReturn<RT> | InferValue<This>,
			InferGeneratorError<RT>
		>
	>;
	// Returns Result<V, E>
	recover<This extends AnyResult, V, E>(
		this: This,
		onFailure: (error: InferError<This>) => Result<V, E>,
	): OuterResult<V | InferValue<This>, E>;
	// Returns AsyncResult<V, E>
	recover<This extends AnyResult, V, E>(
		this: This,
		onFailure: (error: InferError<This>) => AsyncResult<V, E>,
	): AsyncResult<V | InferValue<This>, E>;
	// Returns union of Result/AsyncResult types
	recover<This extends AnyResult, RT extends AnyResult | AnyAsyncResult>(
		this: This,
		onFailure: (error: InferError<This>) => RT,
	): Contains<RT, AnyAsyncResult> extends true
		? AsyncResult<InferValue<RT> | InferValue<This>, InferError<RT>>
		: OuterResult<InferValue<RT> | InferValue<This>, InferError<RT>>;
	// Returns Promise<Result<V, E> | AsyncResult<V, E>>
	recover<This extends AnyResult, V, E>(
		this: This,
		onFailure: (
			error: InferError<This>,
		) => Promise<Result<V, E> | AsyncResult<V, E>>,
	): AsyncResult<V | InferValue<This>, E>;
	// Returns Promise<union of Result/AsyncResult types> — distributive fallback
	recover<This extends AnyResult, RT extends AnyResult | AnyAsyncResult>(
		this: This,
		onFailure: (error: InferError<This>) => Promise<RT>,
	): AsyncResult<InferValue<RT> | InferValue<This>, InferError<RT>>;
	// Returns Promise<V>
	recover<This extends AnyResult, V>(
		this: This,
		onFailure: (error: InferError<This>) => Promise<V>,
	): AsyncResult<V | InferValue<This>, never>;
	// Catch-all (plain V)
	recover<This extends AnyResult, V>(
		this: This,
		onFailure: (error: InferError<This>) => V,
	): OuterResult<V | InferValue<This>, never>;
	recover(this: AnyResult, onFailure: (error: any) => any) {
		return this.success
			? isAsyncFn(onFailure)
				? AsyncResult.ok(this._value)
				: this
			: run(() => onFailure(this._error));
	}

	/**
	 * Like {@linkcode Result.recover}, but catches any exceptions that might be thrown inside the
	 * {@link onFailure} callback and encapsulates them in a failed result.
	 *
	 * @param onFailure callback function to transform the error of the result. The callback can be async or a generator function as well
	 * @param transformError optional callback to transform the caught error. Defaults to `Error` when not provided
	 * @returns a new successful {@linkcode Result} instance or a new successful {@linkcode AsyncResult} instance
	 * when the result represents a failure, or the original instance if it represents a success
	 *
	 * @example Catching a thrown exception during recovery
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * const recovered = result.recoverCatching((error) => {
	 *   if (error.message === "fatal") throw new Error("unrecoverable");
	 *   return 0;
	 * }); // Result<number, Error>
	 * ```
	 *
	 * @example Using transformError to provide domain errors
	 * ```ts
	 * declare const result: Result<number, Error>;
	 *
	 * const recovered = result.recoverCatching(
	 *   (error) => { throw new Error("recovery failed"); },
	 *   (error) => new RecoveryError("Could not recover", { cause: error }),
	 * ); // Result<number, RecoveryError>
	 * ```
	 */
	// Dead-end: error is never (only success possible), recoverCatching is ignored
	recoverCatching(
		this: Result<Value, never>,
		onFailure: (error: Err) => any,
		transformError?: (err: unknown) => any,
	): OuterResult.Ok<Value>;
	// Generator/AsyncGenerator
	recoverCatching<
		This extends AnyResult,
		RT extends Generator | AsyncGenerator,
		ErrorType = NativeError,
	>(
		this: This,
		onFailure: (error: InferError<This>) => RT,
		transformError?: (err: unknown) => ErrorType,
	): IfGeneratorAsync<
		RT,
		AsyncResult<
			InferGeneratorReturn<RT> | InferValue<This>,
			InferGeneratorError<RT> | ErrorType
		>,
		OuterResult<
			InferGeneratorReturn<RT> | InferValue<This>,
			InferGeneratorError<RT> | ErrorType
		>
	>;
	// Returns Result<V, E>
	recoverCatching<This extends AnyResult, V, E, ErrorType = NativeError>(
		this: This,
		onFailure: (error: InferError<This>) => Result<V, E>,
		transformError?: (err: unknown) => ErrorType,
	): OuterResult<V | InferValue<This>, E | ErrorType>;
	// Returns AsyncResult<V, E>
	recoverCatching<This extends AnyResult, V, E, ErrorType = NativeError>(
		this: This,
		onFailure: (error: InferError<This>) => AsyncResult<V, E>,
		transformError?: (err: unknown) => ErrorType,
	): AsyncResult<V | InferValue<This>, E | ErrorType>;
	// Returns union of Result/AsyncResult types
	recoverCatching<
		This extends AnyResult,
		RT extends AnyResult | AnyAsyncResult,
		ErrorType = NativeError,
	>(
		this: This,
		onFailure: (error: InferError<This>) => RT,
		transformError?: (err: unknown) => ErrorType,
	): Contains<RT, AnyAsyncResult> extends true
		? AsyncResult<InferValue<RT> | InferValue<This>, InferError<RT> | ErrorType>
		: OuterResult<
				InferValue<RT> | InferValue<This>,
				InferError<RT> | ErrorType
			>;
	// Returns Promise<Result<V, E> | AsyncResult<V, E>>
	recoverCatching<This extends AnyResult, V, E, ErrorType = NativeError>(
		this: This,
		onFailure: (
			error: InferError<This>,
		) => Promise<Result<V, E> | AsyncResult<V, E>>,
		transformError?: (err: unknown) => ErrorType,
	): AsyncResult<V | InferValue<This>, E | ErrorType>;
	// Returns Promise<union of Result/AsyncResult types> — distributive fallback
	recoverCatching<
		This extends AnyResult,
		RT extends AnyResult | AnyAsyncResult,
		ErrorType = NativeError,
	>(
		this: This,
		onFailure: (error: InferError<This>) => Promise<RT>,
		transformError?: (err: unknown) => ErrorType,
	): AsyncResult<InferValue<RT> | InferValue<This>, InferError<RT> | ErrorType>;
	// Returns Promise<V>
	recoverCatching<This extends AnyResult, V, ErrorType = NativeError>(
		this: This,
		onFailure: (error: InferError<This>) => Promise<V>,
		transformError?: (err: unknown) => ErrorType,
	): AsyncResult<V | InferValue<This>, ErrorType>;
	// Catch-all (plain V)
	recoverCatching<This extends AnyResult, V, ErrorType = NativeError>(
		this: This,
		onFailure: (error: InferError<This>) => V,
		transformError?: (err: unknown) => ErrorType,
	): OuterResult<V | InferValue<This>, ErrorType>;
	recoverCatching(
		this: AnyResult,
		onFailure: (error: any) => any,
		transformError?: (err: unknown) => any,
	): any {
		return this.success
			? isAsyncFn(onFailure)
				? AsyncResult.ok(this._value)
				: this
			: tryCatch(() => onFailure(this._error), transformError as AnyFunction);
	}

	/**
	 * Returns a string representation of the result, including the encapsulated value or error.
	 *
	 * @returns `"Result.ok(<value>)"` for successful results, `"Result.error(<error>)"` for failures
	 *
	 * @example
	 * ```ts
	 * Result.ok(42).toString();              // "Result.ok(42)"
	 * Result.ok("hello").toString();          // "Result.ok(hello)"
	 * Result.error("not found").toString();   // "Result.error(not found)"
	 * Result.error(new Error("x")).toString(); // "Result.error(Error: x)"
	 * ```
	 */
	toString(): string {
		if (this.success) {
			return `Result.ok(${this._value})`;
		}

		return `Result.error(${this.error})`;
	}
}

/**
 * @internal
 */
export function createOk(value?: unknown) {
	return new Result(true, value, undefined);
}

/**
 * @internal
 */
export function createError<Err extends {}>(error: Err) {
	return new Result(false, undefined as never, error);
}

/**
 * @internal
 */
export function isResultInstance(
	possibleResult: unknown,
): possibleResult is AnyOuterResult {
	return possibleResult instanceof Result;
}

/**
 * @internal
 */
export function isAsyncResultInstance(
	possibleAsyncResult: unknown,
): possibleAsyncResult is AnyAsyncResult {
	return possibleAsyncResult instanceof AsyncResult;
}

/**
 * @internal
 */
export function run(fn: AnyFunction): AnyResult | AnyAsyncResult {
	const returnValue = fn();

	if (isGenerator(returnValue) || isAsyncGenerator(returnValue)) {
		return handleGenerator(returnValue);
	}

	if (isPromise(returnValue)) {
		return AsyncResult.fromPromise(returnValue);
	}

	return isResultInstance(returnValue) ? returnValue : createOk(returnValue);
}

/**
 * @internal
 */
export function tryCatch(
	fn: AnyFunction | AnyAsyncFunction,
	transform?: (error: unknown) => any,
) {
	try {
		const returnValue = fn();

		if (isGenerator(returnValue)) {
			return handleGenerator(returnValue);
		}

		if (isAsyncGenerator(returnValue)) {
			const asyncResult = handleGenerator(returnValue) as AnyAsyncResult;
			return AsyncResult.fromPromiseCatching(asyncResult, transform);
		}

		if (isPromise(returnValue)) {
			return AsyncResult.fromPromiseCatching(returnValue, transform);
		}

		return isResultInstance(returnValue) ? returnValue : createOk(returnValue);
	} catch (caughtError: unknown) {
		return createError(transform?.(caughtError) ?? caughtError);
	}
}

/**
 * @internal
 */
export function handleGenerator(it: Generator | AsyncGenerator) {
	function handleResult(result: AnyResult) {
		if (!result.ok) {
			return iterate(it.return(result));
		}

		return iterate(it.next(result.value));
	}

	function handleStep(
		step: IteratorResult<unknown>,
	): AnyResult | Promise<AnyResult> {
		if (step.done) {
			if (step.value instanceof Result || step.value instanceof AsyncResult) {
				return step.value;
			}

			return createOk(step.value);
		}

		if (step.value instanceof Result) {
			return handleResult(step.value);
		}

		if (step.value instanceof AsyncResult) {
			return step.value.then(handleResult);
		}

		return iterate(it.next(step.value)); // unlikely to happen, but just in case
	}

	function iterate(
		iteratorResult: IteratorResult<unknown> | Promise<IteratorResult<unknown>>,
	) {
		return isPromise(iteratorResult)
			? iteratorResult.then(handleStep)
			: handleStep(iteratorResult);
	}

	const result = iterate(it.next())!;

	return isPromise(result) ? AsyncResult.fromPromise(result) : result;
}
