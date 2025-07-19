import {
	type AnyPromise,
	type Constructor,
	type Contains,
	isAsyncFn,
	isFunction,
	isPromise,
} from "./helpers.js";

export class NonExhaustiveError<E> extends Error {
	constructor(public readonly error: E) {
		super("Not all error cases were handled");
	}
}

export class RedundantElseClauseError<T> extends Error {
	/* c8 ignore next 3 */
	constructor(public readonly error: T) {
		super();
	}
}

type ExtractHandledCases<T extends readonly any[]> = {
	[I in keyof T]: T[I] extends Constructor<infer U> ? U : T[I];
}[number];

type WhenValue<E> = Constructor<Extract<E, object>> | E;

export class Matcher<out E, InferredOutput = never> {
	private cases: { value: unknown; handler: (error: unknown) => any }[] = [];
	private defaultHandler: ((error: any) => any) | undefined = undefined;

	/**
	 * @internal
	 */
	constructor(private error: E) {}

	/**
	 * Let's you match against one or more error types.
	 * If the error matches one of the provided types, the corresponding handler will be called.
	 * The last argument must be a handler function, and the preceding arguments must be either
	 * the error class (constructor) or a literal value (e.g. string).
	 *
	 * @example
	 * Match using the class of the error:
	 * ```ts
	 * class ErrorA extends Error {
	 *   readonly type = "error-a";
	 * }
	 *
	 * matcher.when(ErrorA, (error) => console.log("Handled ErrorA:", error));
	 * ```
	 *
	 * @example
	 * Match on multiple error classes with a single handler:
	 * ```ts
	 * class ErrorA extends Error {
	 *   readonly type = "error-a";
	 * }
	 *
	 * class ErrorB extends Error {
	 *   readonly type = "error-b";
	 * }
	 *
	 * matcher.when(ErrorA, ErrorB, (error) => {
	 *   console.log("Handled ErrorA or ErrorB:", error);
	 * });
	 * ```
	 *
	 * @example
	 * Match using a literal value:
	 * ```ts
	 * matcher.when("SOME_ERROR_CODE", (error) => console.log("Handled error with code:", error));
	 * ```
	 */
	when<
		T extends WhenValue<E>,
		U extends readonly WhenValue<E>[],
		R,
		HandledCases = ExtractHandledCases<[T, ...U]>,
	>(value: T, ...args: [...rest: U, handler: (error: HandledCases) => R]) {
		const cases = [value, ...args.slice(0, -1)] as unknown[];
		const handler = args.at(-1) as (error: unknown) => R;
		this.cases.push(...cases.map((value) => ({ value, handler })));
		return this as Matcher<Exclude<E, HandledCases>, InferredOutput | R>;
	}

	/**
	 * Registers a handler that will be called if no other case matches.
	 * Note: you can only register one `else` handler, otherwise it will throw an error.
	 * Note: TS will complain if you try to register an `else` handler when all error cases
	 * are already handled.
	 *
	 * @example
	 * ```ts
	 * matcher.else((error) =>
	 *   console.log("Handled any other error:", error);
	 * );
	 * ```
	 */
	readonly else = ((handler) => {
		if (this.defaultHandler) {
			throw new Error("already registered an 'else' handler");
		}

		this.defaultHandler = handler;
		return this as any;
	}) as [E] extends [never]
		? RedundantElseClauseError<"All error cases are already handled">
		: <R>(handler: (error: E) => R) => Matcher<never, InferredOutput | R>;

	/**
	 * Executes the matcher and returns the result of the first matching handler.
	 * If no handler matches, it will call the `else` handler if registered,
	 * or throw a `NonExhaustiveError` if no `else` handler is registered.
	 *
	 * Note: If not all error cases are handled, this will throw a `NonExhaustiveError`,
	 * and TS will complain with a helpful message indicating which cases are not handled.
	 */
	readonly run = (() => {
		const isAsync = this.cases.some((item) => isAsyncFn(item.handler));

		for (const item of this.cases) {
			const match =
				(isFunction(item.value) && this.error instanceof item.value) ||
				item.value === this.error;

			if (match) {
				const value = item.handler(this.error);
				return isPromise(value)
					? value
					: isAsync
						? Promise.resolve(value)
						: value;
			}
		}

		if (this.defaultHandler) {
			return this.defaultHandler(this.error);
		}

		throw new NonExhaustiveError(this.error);
	}) as [E] extends [never]
		? () => Contains<InferredOutput, AnyPromise> extends true
				? Promise<Awaited<InferredOutput>>
				: InferredOutput
		: NonExhaustiveError<E>;
}
