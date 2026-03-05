import type {
	AnyAsyncFunction,
	AnyFunction,
	AnyPromise,
	Defined,
	NativeError,
} from "./helpers.js";
import {
	isAsyncGenerator,
	isFunction,
	isGenerator,
	isPromise,
} from "./helpers.js";
import {
	AsyncResult,
	createError,
	createOk,
	handleGenerator,
	isAsyncResultInstance,
	isResultInstance,
	type Result,
	run,
	tryCatch,
} from "./result.js";
import type {
	AccountForThrowing,
	AccountForThrowingPerPosition,
	AnyAsyncResult,
	AnyOuterResult,
	AnyResult,
	ExtractError,
	ExtractErrors,
	ExtractValue,
	ExtractValues,
	GenAsync,
	GenSync,
	IfGeneratorAsync,
	IfGeneratorParamsAsync,
	InferError,
	InferGeneratorError,
	InferGeneratorReturn,
	InferValue,
	ListContainsAsync,
	OuterResult,
	UnwrapList,
	YieldedError,
} from "./types.js";

/**
 * Static factory and utility methods for working with {@linkcode Result} and {@linkcode AsyncResult}.
 *
 * This class is re-exported as the `Result` namespace, so all methods are available as `Result.ok()`,
 * `Result.error()`, `Result.try()`, `Result.gen()`, `Result.all()`, `Result.wrap()`, etc.
 *
 * Key methods:
 * - {@linkcode ResultFactory.ok | Result.ok} / {@linkcode ResultFactory.error | Result.error} — create result instances
 * - {@linkcode ResultFactory.try | Result.try} — execute a function and catch exceptions
 * - {@linkcode ResultFactory.gen | Result.gen} — run a generator function with `yield*` short-circuiting
 * - {@linkcode ResultFactory.all | Result.all} — combine multiple operations (like `Promise.all`)
 * - {@linkcode ResultFactory.any | Result.any} — return first success among multiple operations (like `Promise.any`)
 * - {@linkcode ResultFactory.wrap | Result.wrap} — wrap an existing function to return a result
 * - {@linkcode ResultFactory.fromAsync | Result.fromAsync} — lift a Promise into an AsyncResult
 */
export class ResultFactory {
	/* c8 ignore next */
	private constructor() {}

	/**
	 * Creates a new result instance that represents a successful outcome.
	 *
	 * @param value The value to encapsulate in the result.
	 * @returns a new {@linkcode Result} instance.
	 *
	 * @example
	 * ```ts
	 * const result = Result.ok(42); // Result.Ok<number>
	 * ```
	 */
	static ok(): OuterResult.Ok<void>;
	static ok<Value>(value: Value): OuterResult.Ok<Value>;
	static ok(value?: unknown) {
		return createOk(value);
	}

	/**
	 * Creates a new result instance that represents a failed outcome.
	 *
	 * @param error The error to encapsulate in the result.
	 * @returns a new {@linkcode Result} instance.
	 *
	 * @example
	 * ```ts
	 * const result = Result.error(new NotFoundError()); // Result.Error<NotFoundError>
	 * ```
	 */
	static error<const Err extends string>(error: Err): OuterResult.Error<Err>;
	static error<Err extends {}>(error: Err): OuterResult.Error<Err>;
	static error<Err extends {}>(error: Err) {
		return createError(error);
	}

	/**
	 * Type guard that checks whether the provided value is a {@linkcode Result} instance.
	 *
	 * @param possibleResult any value that might be a {@linkcode Result} instance.
	 * @returns true if the provided value is a {@linkcode Result} instance, otherwise false.
	 */
	static isResult(possibleResult: unknown): possibleResult is AnyOuterResult {
		return isResultInstance(possibleResult);
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
		return isAsyncResultInstance(possibleAsyncResult);
	}

	/**
	 * @internal
	 */
	static anyInternal(
		items: any[],
		opts: { catching: boolean },
	): AnyResult | AnyAsyncResult {
		const runner = opts.catching ? ResultFactory.try : run;

		const flattened: Array<AnyResult | AnyAsyncResult> = [];

		let isAsync = items.some(isPromise);
		let hasSuccess = false;

		for (const item of items) {
			if (isFunction(item)) {
				if (hasSuccess) {
					continue;
				}

				const returnValue = runner(item as AnyFunction);

				if (isResultInstance(returnValue) && returnValue.ok) {
					hasSuccess = true;
					if (!isAsync) {
						return returnValue;
					}
				}

				if (isAsyncResultInstance(returnValue)) {
					isAsync = true;
				}

				flattened.push(returnValue);
			} else if (isResultInstance(item)) {
				if (item.ok) {
					hasSuccess = true;
					if (!isAsync) {
						return item;
					}
				}

				flattened.push(item);
			} else if (isAsyncResultInstance(item)) {
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
				// literal value = immediate success
				hasSuccess = true;
				if (!isAsync) {
					return createOk(item);
				}
				flattened.push(createOk(item));
			}
		}

		if (isAsync) {
			return new AsyncResult((resolve, reject) => {
				const asyncResults: AnyAsyncResult[] = [];
				const asyncIndexes: number[] = [];

				for (let i = 0; i < flattened.length; i++) {
					const item = flattened[i];
					if (isAsyncResultInstance(item)) {
						asyncResults.push(item);
						asyncIndexes.push(i);
					}
				}

				// Check if any sync result already succeeded
				for (let i = 0; i < flattened.length; i++) {
					const item = flattened[i];
					if (isResultInstance(item) && item.ok) {
						// Race: resolve immediately but still need to wait for async
						// items to avoid unhandled rejections. However, since we found
						// a sync success, we can resolve right away.
						// Consume async results to prevent unhandled promise rejections
						Promise.all(asyncResults).catch(/* c8 ignore next */ () => {});
						resolve(item);
						return;
					}
				}

				let settled = 0;
				let done = false;

				const tryResolve = (result: AnyResult) => {
					if (done) return;
					if (result.ok) {
						done = true;
						// Consume remaining async results to prevent unhandled rejections
						Promise.all(asyncResults).catch(/* c8 ignore next */ () => {});
						resolve(result);
						return;
					}
					settled++;
					if (settled === asyncResults.length) {
						// All async settled as errors — merge with sync results
						const merged = [...flattened] as AnyResult[];
						for (let i = 0; i < resolvedResults.length; i++) {
							merged[asyncIndexes[i]!] = resolvedResults[i]!;
						}
						resolve(createError(merged.map((r) => r.errorOrNull())));
					}
				};

				const resolvedResults: AnyResult[] = new Array(asyncResults.length);

				for (let i = 0; i < asyncResults.length; i++) {
					asyncResults[i]!.then((result) => {
						resolvedResults[i] = result;
						tryResolve(result);
					})
						/* c8 ignore start -- only fires when catching=false and async rejects */
						.catch((reason) => {
							if (!done) {
								done = true;
								reject(reason);
							}
						});
					/* c8 ignore stop */
				}
			});
		}

		// All sync, no success found → collect all errors
		return createError(
			(flattened as AnyResult[]).map((result) => result.errorOrNull()),
		);
	}

	/**
	 * @internal
	 */
	static allInternal(
		items: any[],
		opts: { catching: boolean },
	): AnyResult | AnyAsyncResult {
		const runner = opts.catching ? ResultFactory.try : run;

		const flattened: Array<AnyResult | AnyAsyncResult> = [];

		let isAsync = items.some(isPromise);
		let hasFailure = false;

		for (const item of items) {
			if (isFunction(item)) {
				if (hasFailure) {
					continue;
				}

				const returnValue = runner(item as AnyFunction);

				if (isResultInstance(returnValue) && !returnValue.ok) {
					hasFailure = true;
					if (!isAsync) {
						return returnValue;
					}
				}

				if (isAsyncResultInstance(returnValue)) {
					isAsync = true;
				}

				flattened.push(returnValue);
			} else if (isResultInstance(item)) {
				if (!item.ok) {
					hasFailure = true;
					if (!isAsync) {
						return item;
					}
				}

				flattened.push(item);
			} else if (isAsyncResultInstance(item)) {
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
				flattened.push(createOk(item));
			}
		}

		if (isAsync) {
			return new AsyncResult((resolve, reject) => {
				const asyncResults: AnyAsyncResult[] = [];
				const asyncIndexes: number[] = [];

				for (let i = 0; i < flattened.length; i++) {
					const item = flattened[i];
					if (isAsyncResultInstance(item)) {
						asyncResults.push(item);
						asyncIndexes.push(i);
					}
				}

				Promise.all(asyncResults)
					.then((resolvedResults) => {
						const merged = [...flattened] as AnyResult[];
						for (let i = 0; i < resolvedResults.length; i++) {
							merged[asyncIndexes[i]!] = resolvedResults[i]!;
						}

						const firstFailedResult = merged.find(
							(resolvedResult) => !resolvedResult.ok,
						);
						if (firstFailedResult) {
							resolve(firstFailedResult);
							return;
						}

						resolve(createOk(merged.map((result) => result.getOrNull())));
					})
					.catch((reason) => {
						// note: this should only happen when opts.catching is false
						reject(reason);
					});
			});
		}

		return createOk(
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
	 * @param items one or multiple literal value, function, {@linkcode Result} or {@linkcode AsyncResult} instance, {@linkcode Promise}, or (async) generator function.
	 * @returns combined result of all the operations.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown are not caught, so it is your responsibility
	 * > to handle these exceptions. Please refer to {@linkcode Result.allCatching} for a version that catches exceptions
	 * > and encapsulates them in a failed result.
	 *
	 * @example Combining multiple results
	 * ```ts
	 * declare function createTask(name: string): Result<Task, IOError>;
	 *
	 * const tasks = ["task-a", "task-b", "task-c"];
	 * const result = Result.all(...tasks.map(createTask)); // Result<Task[], IOError>
	 * ```
	 *
	 * @example Mixing different input types
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
	 *   function* () {
	 *     return "i";
	 *   }
	 * ); // AsyncResult<[string, string, string, string, string, string, string, string, string], Error>
	 * ```
	 */
	static all<Items extends any[], Unwrapped extends any[] = UnwrapList<Items>>(
		...items: Items
	) {
		return ResultFactory.allInternal(items, {
			catching: false,
		}) as ListContainsAsync<Items> extends true
			? AsyncResult<ExtractValues<Unwrapped>, ExtractErrors<Unwrapped>[number]>
			: OuterResult<ExtractValues<Unwrapped>, ExtractErrors<Unwrapped>[number]>;
	}

	/**
	 * Similar to {@linkcode Result.all}, but catches any exceptions that might be thrown during the operations
	 * and encapsulates them in a failed result. The error type of thrown exceptions defaults to `Error` unless
	 * a `transformError` is provided at the call-site level (e.g. via wrapped functions).
	 *
	 * @param items one or multiple literal value, function, {@linkcode Result} or {@linkcode AsyncResult} instance, or {@linkcode Promise}
	 * @returns combined result of all the operations
	 *
	 * @example Catching a thrown exception
	 * ```ts
	 * const result = Result.allCatching(
	 *   () => { throw new Error("boom"); },
	 *   Result.ok(42),
	 * ); // Result<[never, number], Error>
	 *
	 * if (!result.ok) {
	 *   result.error; // Error
	 * }
	 * ```
	 *
	 * @example Catching an async rejection
	 * ```ts
	 * const result = Result.allCatching(
	 *   Promise.reject(new Error("network failure")),
	 *   Result.ok("cached"),
	 * ); // AsyncResult<[never, string], Error>
	 * ```
	 */
	static allCatching<
		Items extends any[],
		Unwrapped extends any[] = UnwrapList<Items>,
	>(...items: Items) {
		return ResultFactory.allInternal(items, {
			catching: true,
		}) as ListContainsAsync<Items> extends true
			? AsyncResult<
					ExtractValues<Unwrapped>,
					ExtractErrors<Unwrapped>[number] | AccountForThrowing<Items>
				>
			: OuterResult<
					ExtractValues<Unwrapped>,
					ExtractErrors<Unwrapped>[number] | AccountForThrowing<Items>
				>;
	}

	/**
	 * Similar to {@linkcode Promise.any}, but for results. The dual of {@linkcode Result.all}.
	 * Returns the first successful value among the provided items, or a tuple of all errors if everything fails.
	 * Each argument can be a mixture of literal values, functions, {@linkcode Result} or {@linkcode AsyncResult} instances, or {@linkcode Promise}.
	 *
	 * @param items one or multiple literal value, function, {@linkcode Result} or {@linkcode AsyncResult} instance, or {@linkcode Promise}.
	 * @returns the first successful value, or a tuple of all errors.
	 *
	 * > [!NOTE]
	 * > Any exceptions that might be thrown are not caught, so it is your responsibility
	 * > to handle these exceptions. Please refer to {@linkcode Result.anyCatching} for a version that catches exceptions
	 * > and encapsulates them in a failed result.
	 *
	 * @example Returning the first success
	 * ```ts
	 * declare function fetchFromCache(): Result<User, CacheMissError>;
	 * declare function fetchFromDb(): Result<User, DbError>;
	 *
	 * const result = Result.any(fetchFromCache, fetchFromDb); // Result<User, [CacheMissError, DbError]>
	 * ```
	 *
	 * @example Mixing different input types
	 * ```ts
	 * const result = Result.any(
	 *   Result.error("not found"),
	 *   () => Result.ok("fallback"),
	 * ); // Result<string, [string, never]>
	 * ```
	 */
	static any<Items extends any[], Unwrapped extends any[] = UnwrapList<Items>>(
		...items: Items
	) {
		return ResultFactory.anyInternal(items, {
			catching: false,
		}) as ListContainsAsync<Items> extends true
			? AsyncResult<ExtractValues<Unwrapped>[number], ExtractErrors<Unwrapped>>
			: OuterResult<ExtractValues<Unwrapped>[number], ExtractErrors<Unwrapped>>;
	}

	/**
	 * Similar to {@linkcode Result.any}, but catches any exceptions that might be thrown during the operations
	 * and encapsulates them in a failed result. The error type of thrown exceptions defaults to `Error` unless
	 * a `transformError` is provided at the call-site level (e.g. via wrapped functions).
	 *
	 * @param items one or multiple literal value, function, {@linkcode Result} or {@linkcode AsyncResult} instance, or {@linkcode Promise}
	 * @returns the first successful value, or a tuple of all errors (including caught exceptions)
	 *
	 * @example Catching a thrown exception
	 * ```ts
	 * const result = Result.anyCatching(
	 *   () => { throw new Error("boom"); },
	 *   Result.ok(42),
	 * ); // Result<never | number, [Error, never]>
	 * ```
	 */
	static anyCatching<
		Items extends any[],
		Unwrapped extends any[] = UnwrapList<Items>,
	>(...items: Items) {
		return ResultFactory.anyInternal(items, {
			catching: true,
		}) as ListContainsAsync<Items> extends true
			? AsyncResult<
					ExtractValues<Unwrapped>[number],
					AccountForThrowingPerPosition<Items, ExtractErrors<Unwrapped>>
				>
			: OuterResult<
					ExtractValues<Unwrapped>[number],
					AccountForThrowingPerPosition<Items, ExtractErrors<Unwrapped>>
				>;
	}

	/**
	 * Wraps a function and returns a new function that returns a result. Especially useful when you want to work with
	 * external functions that might throw exceptions.
	 * The returned function will catch any exceptions that might be thrown and encapsulate them in a failed result.
	 *
	 * @param fn function to wrap. Can be synchronous or asynchronous
	 * @param transformError optional callback to transform the caught error into a more meaningful error
	 * @returns a new function that returns a result
	 *
	 * @example Wrapping a synchronous function
	 * ```ts
	 * declare function divide(a: number, b: number): number;
	 *
	 * const safeDivide = Result.wrap(divide);
	 * const result = safeDivide(10, 0); // Result<number, Error>
	 * ```
	 *
	 * @example Wrapping an async function
	 * ```ts
	 * declare function fetchUser(id: string): Promise<User>;
	 *
	 * const safeFetchUser = Result.wrap(fetchUser);
	 * const result = safeFetchUser("123"); // AsyncResult<User, Error>
	 * ```
	 *
	 * @example Using transformError
	 * ```ts
	 * declare function parseConfig(raw: string): Config;
	 *
	 * const safeParseConfig = Result.wrap(
	 *   parseConfig,
	 *   (error) => new ConfigError("Invalid config", { cause: error }),
	 * );
	 * const result = safeParseConfig("{}"); // Result<Config, ConfigError>
	 * ```
	 */
	static wrap<Fn extends AnyAsyncFunction, ErrorType = NativeError>(
		fn: Fn,
		transformError?: (error: unknown) => ErrorType,
	): (
		...args: Parameters<Fn>
	) => AsyncResult<Awaited<ReturnType<Fn>>, ErrorType>;
	static wrap<Fn extends AnyFunction, ErrorType = NativeError>(
		fn: Fn,
		transformError?: (error: unknown) => ErrorType,
	): (...args: Parameters<Fn>) => OuterResult<ReturnType<Fn>, ErrorType>;
	static wrap(
		fn: AnyFunction | AnyAsyncFunction,
		transformError?: (error: unknown) => Defined,
	): AnyFunction {
		return function wrapped(...args: any[]) {
			return ResultFactory.try(() => fn(...args), transformError!);
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
	 * @example Wrapping a throwing function
	 * ```ts
	 * declare function saveFileToDisk(filename: string): void; // might throw an error
	 *
	 * const result = Result.try(() => saveFileToDisk("file.txt")); // Result<void, Error>
	 * ```
	 *
	 * @example Transforming the caught error
	 * ```ts
	 * declare function saveFileToDisk(filename: string): void; // might throw an error
	 *
	 * const result = Result.try(
	 *   () => saveFileToDisk("file.txt"),
	 *   (error) => new IOError("Failed to save file", { cause: error })
	 * ); // Result<void, IOError>
	 * ```
	 */
	static try<R extends Generator | AsyncGenerator>(
		fn: () => R,
	): IfGeneratorAsync<
		R,
		AsyncResult<InferGeneratorReturn<R>, InferGeneratorError<R> | NativeError>,
		OuterResult<InferGeneratorReturn<R>, InferGeneratorError<R> | NativeError>
	>;
	static try<R extends Generator | AsyncGenerator, ErrorType extends Defined>(
		fn: () => R,
		transform: (error: unknown) => ErrorType,
	): IfGeneratorAsync<
		R,
		AsyncResult<InferGeneratorReturn<R>, InferGeneratorError<R> | ErrorType>,
		OuterResult<InferGeneratorReturn<R>, InferGeneratorError<R> | ErrorType>
	>;
	static try<
		Fn extends AnyAsyncFunction<AnyResult>,
		R = Awaited<ReturnType<Fn>>,
	>(fn: Fn): AsyncResult<InferValue<R>, InferError<R> | NativeError>;
	static try<Fn extends AnyFunction<AnyResult>, R = ReturnType<Fn>>(
		fn: Fn,
	): OuterResult<InferValue<R>, InferError<R> | NativeError>;
	static try<ReturnType extends AnyPromise>(
		fn: () => ReturnType,
	): AsyncResult<Awaited<ReturnType>, NativeError>;
	static try<ReturnType>(
		fn: () => ReturnType,
	): OuterResult<ReturnType, NativeError>;
	static try<ReturnType extends AnyPromise, ErrorType extends Defined>(
		fn: () => ReturnType,
		transform: (error: unknown) => ErrorType,
	): AsyncResult<Awaited<ReturnType>, ErrorType>;
	static try<ReturnType, ErrorType extends Defined>(
		fn: () => ReturnType,
		transform: (error: unknown) => ErrorType,
	): OuterResult<ReturnType, ErrorType>;
	static try(
		fn: AnyFunction | AnyAsyncFunction,
		transform?: (error: unknown) => any,
	) {
		return tryCatch(fn, transform);
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
	 * @example Wrapping an async callback
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
	 * @example Lifting a Promise into an AsyncResult
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
		return run(typeof valueOrFn === "function" ? valueOrFn : () => valueOrFn);
	}

	/**
	 * Similar to {@linkcode Result.fromAsync}, but catches any exceptions that might be thrown during the async
	 * operation and encapsulates them in a failed result.
	 *
	 * @param fn async callback function that returns a literal value or a {@linkcode Result} or {@linkcode AsyncResult} instance
	 * @param transformError optional callback to transform the caught error into a more meaningful error
	 * @returns a new {@linkcode AsyncResult} instance
	 *
	 * @example Catching a thrown exception
	 * ```ts
	 * const result = Result.fromAsyncCatching(async () => {
	 *   const response = await fetch("https://example.com/api");
	 *   return response.json();
	 * }); // AsyncResult<any, Error>
	 * ```
	 *
	 * @example Using transformError
	 * ```ts
	 * const result = Result.fromAsyncCatching(
	 *   async () => {
	 *     const response = await fetch("https://example.com/api");
	 *     return response.json();
	 *   },
	 *   (error) => new FetchError("API request failed", { cause: error }),
	 * ); // AsyncResult<any, FetchError>
	 * ```
	 */
	static fromAsyncCatching<T, ErrorType = NativeError>(
		fn: () => Promise<T>,
		transformError?: (err: unknown) => ErrorType,
	): AsyncResult<ExtractValue<T>, ExtractError<T> | ErrorType>;
	/**
	 * Similar to {@linkcode Result.fromAsync}, but catches any exceptions that might be thrown during the async
	 * operation and encapsulates them in a failed result.
	 *
	 * @param value a Promise that holds a literal value or a {@linkcode Result} or {@linkcode AsyncResult} instance
	 * @param transformError optional callback to transform the caught error into a more meaningful error
	 * @returns a new {@linkcode AsyncResult} instance
	 */
	static fromAsyncCatching<T, ErrorType = NativeError>(
		value: Promise<T>,
		transformError?: (err: unknown) => ErrorType,
	): AsyncResult<ExtractValue<T>, ExtractError<T> | ErrorType>;
	static fromAsyncCatching(
		valueOrFn: AnyPromise | AnyAsyncFunction,
		transformError?: (err: unknown) => any,
	) {
		return tryCatch(
			typeof valueOrFn === "function" ? valueOrFn : () => valueOrFn,
			transformError as AnyFunction,
		);
	}

	/**
	 * Executes the given {@linkcode fn} (async) generator function and encapsulates the returned value or error as a Result.
	 * This method is often used once as entry point to run a specific flow. The reason for this is that nested generator functions or calls to other functions that return results are supported.
	 *
	 * @param self optional `this` context to bind the generator function to.
	 * @param fn generator function with code to execute. Can be synchronous or asynchronous.
	 * @returns a new {@linkcode Result} or {@linkcode AsyncResult} instance depending on the provided callback fn.
	 *
	 * @example Running an async generator pipeline
	 * ```ts
	 * const result = Result.gen(async function* () {
	 *    const order = yield* getOrderById("123"); // AsyncResult<Order, NotFoundError>
	 *    yield* order.ship(); // Result<void, InvalidOrderStatusError>;
	 *    const arrivalDate = await shipmentService.calculateArrivalDate(order);
	 *    return `Your order has been shipped and is expected to arrive on ${arrivalDate}!`;
	 * }); // AsyncResult<string, NotFoundError | InvalidOrderStatusError>;
	 * ```
	 *
	 * @example Binding a `this` context
	 * ```ts
	 * class MyClass {
	 *   someValue = 12;
	 *
	 *   someMethod() {
	 *     return Result.gen(this, function* () {
	 *       const otherValue = yield* Result.ok(8);
	 *       return `The sum is ${this.someValue + otherValue}`;
	 *     });
	 *   }
	 * }
	 * ```
	 */
	// Sync generator function with possible async yields/returns
	static gen<Y, V, E = never, RAsync = never>(
		fn: () => GenSync<Y, V, E, RAsync>,
	): IfGeneratorParamsAsync<
		Y,
		RAsync,
		AsyncResult<V, YieldedError<Y> | E>,
		OuterResult<V, YieldedError<Y> | E>
	>;

	// Async generator function
	static gen<Y, V, E = never>(
		fn: () => GenAsync<Y, V, E>,
	): AsyncResult<V, YieldedError<Y> | E>;

	// Sync generator function with this context and possible async yields/returns
	static gen<This, Y, V, E = never, RAsync = never>(
		self: This,
		fn: (this: This) => GenSync<Y, V, E, RAsync>,
	): IfGeneratorParamsAsync<
		Y,
		RAsync,
		AsyncResult<V, YieldedError<Y> | E>,
		OuterResult<V, YieldedError<Y> | E>
	>;

	// Async generator function with this context
	static gen<This, Y, V, E = never>(
		self: This,
		fn: (this: This) => GenAsync<Y, V, E>,
	): AsyncResult<V, YieldedError<Y> | E>;

	// Direct sync generator
	static gen<Y, V, E = never, RAsync = never>(
		generator: GenSync<Y, V, E, RAsync>,
	): IfGeneratorParamsAsync<
		Y,
		RAsync,
		AsyncResult<V, YieldedError<Y> | E>,
		OuterResult<V, YieldedError<Y> | E>
	>;

	// Direct async generator
	static gen<Y, V, E = never>(
		generator: GenAsync<Y, V, E>,
	): AsyncResult<V, YieldedError<Y> | E>;

	static gen<T extends Generator | AsyncGenerator>(
		generatorOrSelfOrFn: unknown,
		fn?: () => T,
	) {
		const it =
			isGenerator(generatorOrSelfOrFn) || isAsyncGenerator(generatorOrSelfOrFn)
				? generatorOrSelfOrFn
				: typeof generatorOrSelfOrFn === "function"
					? generatorOrSelfOrFn()
					: fn?.apply(generatorOrSelfOrFn);
		return handleGenerator(it);
	}

	/**
	 * Similar to {@linkcode Result.gen}, but catches any exceptions that might be thrown during any operation
	 * and encapsulates them in a failed result. Returns a {@linkcode Result} or {@linkcode AsyncResult} depending
	 * on whether the generator function contains async operations or not.
	 *
	 * @param generator a generator, generator function, or a `this` context followed by a generator function
	 * @param transformError optional callback to transform the caught error into a more meaningful error
	 * @returns a new {@linkcode Result} or {@linkcode AsyncResult} instance
	 *
	 * @example Catching a thrown exception inside a generator
	 * ```ts
	 * const result = Result.genCatching(function* () {
	 *   const value = yield* Result.ok(42);
	 *   if (value > 40) throw new Error("too large");
	 *   return value;
	 * }); // Result<number, Error>
	 * ```
	 *
	 * @example Using transformError to provide domain errors
	 * ```ts
	 * const result = Result.genCatching(
	 *   function* () {
	 *     const user = yield* findUserById("123"); // Result<User, NotFoundError>
	 *     const data = JSON.parse(user.rawData); // might throw SyntaxError
	 *     return data;
	 *   },
	 *   (error) => new ParseError("Failed to parse user data", { cause: error }),
	 * ); // Result<any, NotFoundError | ParseError>
	 * ```
	 */
	static genCatching<
		T extends Generator | AsyncGenerator,
		ErrorType = NativeError,
	>(
		generator: T,
		transformError?: (error: unknown) => ErrorType,
	): IfGeneratorAsync<
		T,
		AsyncResult<InferGeneratorReturn<T>, InferGeneratorError<T> | ErrorType>,
		OuterResult<InferGeneratorReturn<T>, InferGeneratorError<T> | ErrorType>
	>;
	static genCatching<
		T extends Generator | AsyncGenerator,
		ErrorType = NativeError,
	>(
		fn: () => T,
		transformError?: (error: unknown) => ErrorType,
	): IfGeneratorAsync<
		T,
		AsyncResult<InferGeneratorReturn<T>, InferGeneratorError<T> | ErrorType>,
		OuterResult<InferGeneratorReturn<T>, InferGeneratorError<T> | ErrorType>
	>;
	static genCatching<
		T extends Generator | AsyncGenerator,
		This,
		ErrorType = NativeError,
	>(
		self: This,
		fn: (this: This) => T,
		transformError?: (error: unknown) => ErrorType,
	): IfGeneratorAsync<
		T,
		AsyncResult<InferGeneratorReturn<T>, InferGeneratorError<T> | ErrorType>,
		OuterResult<InferGeneratorReturn<T>, InferGeneratorError<T> | ErrorType>
	>;
	static genCatching(
		generatorOrSelfOrFn: unknown,
		transformValueOrError?: Function,
		transformError?: Function,
	) {
		const isGen =
			isGenerator(generatorOrSelfOrFn) || isAsyncGenerator(generatorOrSelfOrFn);

		const self =
			typeof generatorOrSelfOrFn === "function" || isGen
				? undefined
				: generatorOrSelfOrFn;
		const tValue =
			typeof generatorOrSelfOrFn === "function"
				? generatorOrSelfOrFn
				: transformValueOrError!;
		const tError =
			typeof generatorOrSelfOrFn === "function" || isGen
				? transformValueOrError
				: transformError;

		try {
			const it = isGen
				? generatorOrSelfOrFn
				: self
					? tValue.apply(generatorOrSelfOrFn)
					: tValue();
			const result = handleGenerator(it);

			if (isAsyncResultInstance(result)) {
				return result.catch((error) =>
					AsyncResult.error(tError?.(error) ?? error),
				) as any;
			}

			return result as any;
		} catch (error: unknown) {
			return createError(tError?.(error) ?? error) as any;
		}
	}

	/**
	 * Asserts that the provided result is successful. If the result is a failure, an error is thrown.
	 * Useful in unit tests.
	 *
	 * @param result the result instance to assert against.
	 */
	static assertOk<Value>(
		result: OuterResult<Value, any>,
	): asserts result is OuterResult.Ok<Value> {
		if (!result.ok) {
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
		result: OuterResult<any, Err>,
	): asserts result is OuterResult.Error<Err> {
		if (result.ok) {
			throw new Error("Expected a failed result, but got a value instead");
		}
	}

	/**
	 * @internal
	 */
	static [Symbol.hasInstance](instance: unknown): boolean {
		return isResultInstance(instance);
	}
}
