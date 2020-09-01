/**
 * Util
 */

function isAsyncFn(fn: Function) {
  return fn.constructor.name === "AsyncFunction";
}

interface SyncThenable {
  isSync: true;
  then<Fn extends () => Promise<any>>(cb: Fn): ReturnType<Fn>;
  then<Fn extends () => any>(cb: Fn): SyncThenable;
}

// Utility to emulate a Promise, but where 'then' is initially sync, unless the callback
// returns a real Promise
// This utility function is mainly used within Result.combine in order to loop over callbacks
// that may be sync or async -> we only want to return a Promise when we absolutely need to
function syncThenable(): SyncThenable {
  function then<Fn extends () => Promise<any>>(cb: Fn): ReturnType<Fn>;
  function then<Fn extends () => any>(cb: Fn): SyncThenable;
  function then(cb: any) {
    const result = cb();
    if (result instanceof Promise) {
      return result;
    }

    return syncThenable();
  }

  return {
    isSync: true,
    then,
  };
}

// utility fn to loop over (async) callbacks or values
function forEachValueThunkOrPromise<T>(
  items: unknown[],
  execFn: (value: T) => boolean, // false means error, true means success here
  foldFn: () => unknown
) {
  // we want to break the iteration when an error ocurred
  let shouldBreak = false;

  const result = items.reduce((prev: { then: Function }, valueOrThunk) => {
    return prev.then(() => {
      // if an error ocurred, return early
      if (shouldBreak) {
        return null;
      }

      function run(value: T) {
        const isSuccess = execFn(value);
        if (!isSuccess) {
          shouldBreak = true;
        }
      }

      // if the current item is a function -> run it
      const valueOrPromise =
        typeof valueOrThunk === "function" ? valueOrThunk() : valueOrThunk;

      // if the 'unpacked' item is an actual Promise...
      if (valueOrPromise instanceof Promise) {
        return valueOrPromise.then(run);
      }

      // Apparently we're dealing with sync stuff...
      return run(valueOrPromise);
    });
  }, syncThenable());

  if ((result as SyncThenable).isSync) {
    return foldFn();
  }

  return result.then(() => {
    return foldFn();
  });
}

/**
 * Types
 */

export type Result<
  ErrorType,
  OkType,
  RollbackFn extends RollbackFunction = any
> = Ok<ErrorType, OkType, RollbackFn> | Err<ErrorType, OkType, RollbackFn>;

interface IResult<ErrorType, OkType> {
  /**
   * **Indicates whether the Result is of type Ok**
   *
   * Example:
   * ```tsx
   * const result = doStuff();
   * if (result.isSuccess()) {
   *   result.value; // we now have access to 'value'
   * } else {
   *   result.error; // we now have access to 'error'
   * }
   * ```
   */
  isSuccess(): this is Ok<ErrorType, OkType, any>;

  /**
   * **Indicates whether the Result is of type Error**
   *
   * Example:
   * ```tsx
   * const result = doStuff();
   * if (result.isFailure()) {
   *   result.error; // we now have access to 'error'
   * } else {
   *   result.value; // we now have access to 'value'
   * }
   * ```
   */
  isFailure(): this is Err<ErrorType, OkType, any>;

  /**
   * **Returns the error on failure or null on success**
   *
   * Example:
   * ```tsx
   * // on failure...
   * const result = thisWillFail();
   * const error = result.errorOrNull(); // error is defined
   *
   * // on success...
   * const result = thisWillSucceed();
   * const error = result.errorOrNull(); // error is null
   * ```
   */
  errorOrNull(): ErrorType | null;

  /**
   * **Returns the value on success or null on failure**
   *
   * Example:
   * ```tsx
   * // on success...
   * const result = thisWillSucceed();
   * const value = result.getOrNull(); // value is defined
   *
   * // on failure...
   * const result = thisWillFail();
   * const value = result.getOrNull(); // value is null
   * ```
   */
  getOrNull(): OkType | null;

  /**
   * **Returns a visual representation of the inner value**
   *
   * Example:
   * ```tsx
   * const result = doStuff();
   * const display = result.toString() // 'Result.Ok("value")' | 'Result.Error("error-message")'
   * ```
   */
  toString(): string;

  /**
   * **See Result.toString()**
   */
  inspect(): string;

  /**
   * **Returns the result of the onSuccess-callback for the encapsulated value if this instance represents success or the result of onFailure-callback for the encapsulated error if it is failure.**
   *
   * Example:
   * ```tsx
   * const result = doStuff();
   * const value = result.fold(
   *    // on success...
   *    (value) => value * 2,
   *     // on failure...
   *    (error) => 4
   * );
   * ```
   */
  fold<R>(
    onSuccess: (value: OkType) => R,
    onFailure: (error: ErrorType) => R
  ): R;
  fold<R>(
    onSuccess: (value: OkType) => Promise<R>,
    onFailure: (error: ErrorType) => Promise<R>
  ): Promise<R>;

  /**
   * **Returns the value on success or a default value on failure**
   *
   * Example:
   * ```tsx
   * const result = doStuff();
   * const value = result.getOrDefault(2);
   * ```
   */
  getOrDefault(defaultValue: OkType): OkType;

  /**
   * **Returns the value on success or the return-value of the onFailure-callback on failure**
   *
   * Example:
   * ```tsx
   * const result = doStuff();
   * const value = result.getOrElse((error) => 4);
   * ```
   */
  getOrElse(onFailure: (error: ErrorType) => OkType): OkType;
  getOrElse(onFailure: (error: ErrorType) => Promise<OkType>): Promise<OkType>;

  /**
   * **Returns the value on success or throws the error on failure**
   *
   * Example:
   * ```tsx
   * const result = doStuff();
   * const value = result.getOrThrow();
   * ```
   */
  getOrThrow(): OkType;

  /**
   * **Maps a result to another result**
   * If the result is success, it will call the callback-function with the encapsulated value, which must return another Result.
   * If the result is failure, it will ignore the callback-function.
   *
   * Example:
   * ```tsx
   *
   * class ErrorA extends Error {}
   * class ErrorB extends Error {}
   *
   * function doA(): Result<ErrorA, number> {
   *  // ...
   * }
   *
   * function doB(value: number): Result<ErrorB, string> {
   *  // ...
   * }
   *
   * const result = doA().map(value => doB(value)); // Result<ErrorA | ErrorB, string>
   * ```
   */
  map<T extends Result<any, any, any>>(
    fn: (value: OkType) => T
  ): JoinErrorTypes<ErrorType, T>;
  map<T extends Result<any, any, any>>(
    fn: (value: OkType) => Promise<T>
  ): Promise<JoinErrorTypes<ErrorType, T>>;

  /**
   * **Rolls back things that were successful**
   * This method is especially useful when working with Result.combine()
   */
  rollback(): Result<Error, void> | Promise<Result<Error, void>>;
}

type InferErrorType<T extends Result<any, any, any>> = T extends Result<
  infer Errortype,
  any,
  any
>
  ? Errortype
  : never;

type InferOkType<T extends Result<any, any, any>> = T extends Result<
  any,
  infer OkType,
  any
>
  ? OkType
  : never;

type JoinErrorTypes<ErrorType, B extends Result<any, any, any>> = Result<
  ErrorType | InferErrorType<B>,
  InferOkType<B>,
  any
>;

type ExtractErrorTypes<Tuple extends any[]> = {
  [Index in keyof Tuple]: Tuple[Index] extends Result<any, any, any>
    ? InferErrorType<Tuple[Index]>
    : never;
}[number];

type MapResultTupleToOkTypeTuple<Tuple extends any[]> = {
  [Index in keyof Tuple]: Tuple[Index] extends Result<any, any, any>
    ? InferOkType<Tuple[Index]>
    : never;
};

type RollbackFunction = (() => void) | (() => Promise<void>);

type HasAsyncRollbackFunction<T extends any[]> = {
  [Index in keyof T]: T[Index] extends () => Promise<infer U> | infer U
    ? U extends Result<any, any, () => Promise<void>>
      ? true
      : false
    : false;
}[number] extends false
  ? false
  : true;

type UnwrapThunks<T extends any[]> = {
  [Index in keyof T]: T[Index] extends () => Promise<infer U>
    ? U
    : T[Index] extends () => infer U
    ? U
    : T[Index];
};

type HasAsyncThunk<T extends any[]> = {
  [Index in keyof T]: T[Index] extends () => Promise<any> ? true : false;
}[number] extends false
  ? false
  : true;

type PromiseReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => Promise<infer U>
  ? U
  : never;

/**
 * Creation functions of Result-type
 */

export namespace Result {
  /**
   * **Returns a Result.Ok which contains a encapsulated value**
   *
   * Example:
   * ```tsx
   * const result = Result.ok(12); // Result<unknown, number>
   * ```
   */
  export function ok<
    ErrorType extends unknown,
    OkType,
    RollbackFn extends RollbackFunction = any
  >(
    value?: OkType,
    rollbackFn?: RollbackFn
  ): Result<ErrorType, OkType, RollbackFn> {
    // if (value === null) {
    //   throw new Error(
    //     `Expected thruthy valid value as parameter but instead received: null`
    //   );
    // }

    return new Ok<ErrorType, OkType, RollbackFn>(
      value || null!,
      rollbackFn
    ) as any;
  }

  /**
   * **Returns a Result.Error which contains a encapsulated error**
   *
   * Example:
   * ```tsx
   * const result = Result.error(new Error("Something went wrong!")); // Result<Error, unknown>
   * ```
   */
  export function error<
    ErrorType extends unknown,
    OkType extends unknown,
    RollbackFn extends RollbackFunction = any
  >(
    error: ErrorType,
    rollbackFn?: RollbackFn
  ): Result<ErrorType, OkType, RollbackFn> {
    return new Err<ErrorType, OkType, RollbackFn>(error, rollbackFn);
  }

  /**
   * **Functions as a try-catch, returning the return-value of the callback on success, or the predefined error or caught error on failure **
   *
   * Example:
   * ```tsx
   * // with caught error...
   * const result = Result.safe(() => {
   *   let value = 2;
   *
   *   // code that might throw...
   *
   *   return value;
   * }); // Result<Error, number>
   *
   * // with predefined error...
   * class CustomError extends Error {}
   *
   * const result = Result.safe(new CustomError("Custom error!"), () => {
   *   let value = 2;
   *
   *   // code that might throw...
   *
   *   return value;
   * }); // Result<CustomError, number>
   * ```
   */
  export function safe<ErrorType, OkType>(
    fn: () => Promise<OkType>
  ): Promise<Result<Error, OkType, never>>;
  export function safe<ErrorType, OkType>(
    fn: () => OkType
  ): Result<Error, OkType, never>;
  export function safe<ErrorType, OkType>(
    err: ErrorType,
    fn: () => Promise<OkType>
  ): Promise<Result<ErrorType, OkType, never>>;
  export function safe<ErrorType, OkType>(
    err: ErrorType,
    fn: () => OkType
  ): Result<ErrorType, OkType, never>;
  export function safe(errOrFn: any, fn?: any) {
    const hasCustomError = fn !== undefined;

    const execute = hasCustomError ? fn : errOrFn;

    try {
      const resultOrPromise = execute();

      if (resultOrPromise instanceof Promise) {
        return resultOrPromise
          .then(okValue => Result.ok(okValue))
          .catch(caughtError => error(hasCustomError ? errOrFn : caughtError));
      }

      return ok(resultOrPromise);
    } catch (caughtError) {
      return error(hasCustomError ? errOrFn : caughtError);
    }
  }

  type CombineResult<
    T extends (unknown | (() => unknown) | (() => Promise<unknown>))[]
  > = Result<
    ExtractErrorTypes<UnwrapThunks<T>>,
    MapResultTupleToOkTypeTuple<UnwrapThunks<T>>,
    HasAsyncRollbackFunction<T> extends true ? () => Promise<void> : () => void
  >;

  /**
   * **Accepts multiple Results or functions that return Results and returns a singe Result**
   * Successful values will be placed inside a tuple.
   *
   * Example:
   * ```tsx
   *
   * function doA(): Result<Error, string> {}
   * function doB(value: number): Result<Error, number> {}
   * function doC(value: string): Result<Error, Date> {}
   *
   * const result = Result.combine(
   *   doA(),
   *   () => doB(2),
   *   () => doC("hello")
   * ); // Result<Error, [string, number, Date]>
   *
   * if (result.isSuccess()) {
   *   result.value; // [string, number, Date]
   * }
   * ```
   */

  export function combine<
    T extends (unknown | (() => unknown) | (() => Promise<unknown>))[]
  >(
    ...items: T
  ): HasAsyncThunk<T> extends true
    ? Promise<CombineResult<T>>
    : CombineResult<T> {
    if (!items.length) {
      throw new Error("Expected at least 1 argument");
    }

    const values: unknown[] = [];
    const rollbacks: RollbackFunction[] = [];
    let error: Err<unknown, unknown, any> | null = null;

    function rollback() {
      const reversedRollbacks = rollbacks.reverse();
      const wrappedRollbackFns = reversedRollbacks.map(fn => Result.wrap(fn));

      let error: Err<unknown, unknown, any> | null = null;

      return forEachValueThunkOrPromise(
        wrappedRollbackFns,
        (result: Result<unknown, unknown>) => {
          if (result.isFailure()) {
            error = Result.error<unknown, unknown, any>(result.error) as any;
            return false;
          }

          return true;
        },
        () => error || ok()
      );
    }

    return forEachValueThunkOrPromise(
      items,
      (result: Result<unknown, unknown>) => {
        if (result.isFailure()) {
          error = Result.error<unknown, unknown>(result.error, rollback) as any;
          return false;
        }

        values.push(result.value);
        rollbacks.push(() => result.rollback());
        return true;
      },
      () => error || ok(values, rollback)
    );
  }

  /**
   * **Transforms an existing function into a function that returns a Result**
   *
   * Example:
   * ```tsx
   * function add2(value: number) {
   *  // code that might throw....
   *
   *  return value + 2;
   * }
   *
   * const wrappedAdd2 = Result.wrap(add2);
   *
   * const result1 = add2(4) // number;
   * const result2 = wrappedAdd2(4) // Result<Error, number>;
   * ```
   */

  export function wrap<Fn extends (...args: any) => Promise<any>>(
    fn: Fn
  ): (
    ...args: Parameters<Fn>
  ) => Promise<Result<Error, PromiseReturnType<Fn>, never>>;
  export function wrap<Fn extends (...args: any) => any>(
    fn: Fn
  ): (...args: Parameters<Fn>) => Result<Error, ReturnType<Fn>, never>;
  export function wrap(fn: any) {
    return function wrapped(...args: any) {
      try {
        const resultOrPromise = fn(...args);

        if (resultOrPromise instanceof Promise) {
          return resultOrPromise
            .then(okValue => Result.ok(okValue))
            .catch(err => error(err));
        }

        return ok(resultOrPromise);
      } catch (err) {
        return error(err);
      }
    };
  }
}

/**
 * Underlying Result types
 */

abstract class Base<
  ErrorType extends unknown,
  OkType extends unknown,
  RollbackFn extends RollbackFunction
> implements IResult<ErrorType, OkType> {
  constructor(protected readonly rollbackFn?: RollbackFn) {}

  errorOrNull(): ErrorType | null {
    if (this.isSuccess()) {
      return null;
    }

    return (this as any).error as ErrorType;
  }

  getOrNull(): OkType | null {
    if (this.isFailure()) {
      return null;
    }

    return (this as any).value as OkType;
  }

  toString(): string {
    throw new Error("Method not implemented.");
  }
  inspect(): string {
    return this.toString();
  }

  fold<R>(
    onSuccess: (value: OkType) => R,
    onFailure: (error: ErrorType) => R
  ): R;
  fold<R>(
    onSuccess: (value: OkType) => Promise<R>,
    onFailure: (error: ErrorType) => Promise<R>
  ): Promise<R>;
  fold(onSuccess: any, onFailure: any) {
    if (this.isFailure()) {
      return onFailure(this.error);
    }

    return onSuccess((this as any).value as OkType);
  }

  getOrDefault(defaultValue: OkType): OkType {
    if (this.isSuccess()) {
      return this.value;
    }

    return defaultValue;
  }

  getOrElse(onFailure: (error: ErrorType) => OkType): OkType;
  getOrElse(onFailure: (error: ErrorType) => Promise<OkType>): Promise<OkType>;
  getOrElse(onFailure: any) {
    if (this.isSuccess()) {
      return isAsyncFn(onFailure) ? Promise.resolve(this.value) : this.value;
    }

    return onFailure((this as any).error as ErrorType);
  }

  getOrThrow(): OkType {
    if (this.isFailure()) {
      throw this.error;
    }

    return (this as any).value as OkType;
  }

  isSuccess(): this is Ok<ErrorType, OkType, RollbackFn> {
    throw new Error("Method not implemented.");
  }
  isFailure(): this is Err<ErrorType, OkType, RollbackFn> {
    throw new Error("Method not implemented.");
  }

  map<T extends Result<any, any, any>>(
    fn: (value: OkType) => T
  ): JoinErrorTypes<ErrorType, T>;
  map<T extends Result<any, any, any>>(
    fn: (value: OkType) => Promise<T>
  ): Promise<JoinErrorTypes<ErrorType, T>>;
  map(fn: any) {
    if (this.isFailure()) {
      return isAsyncFn(fn) ? Promise.resolve(this) : this;
    }

    const result = fn((this as any).value) as any;

    return result;
  }

  rollback(): RollbackFn extends RollbackFunction
    ? RollbackFn extends () => Promise<void>
      ? Promise<Result<Error, void>>
      : Result<Error, void>
    : void {
    if (this.rollbackFn) {
      return this.rollbackFn() as any;
    }

    return null as any;
  }
}

class Ok<
  ErrorType extends unknown,
  OkType extends unknown,
  RollbackFn extends RollbackFunction
> extends Base<ErrorType, OkType, RollbackFn> {
  public readonly value: OkType;

  constructor(val: OkType, rollbackFn?: RollbackFn) {
    super(rollbackFn);
    this.value = val;
  }

  isSuccess(): this is Ok<ErrorType, OkType, RollbackFn> {
    return true;
  }

  isFailure(): this is Err<ErrorType, OkType, RollbackFn> {
    return false;
  }

  toString(): string {
    return `Result.Ok(${this.value})`;
  }

  /**
   * **Creates and forwards a brand new Result out of the current error or value **
   */
  forward(): Result<unknown, OkType, RollbackFn> {
    return Result.ok(this.value);
  }
}

class Err<
  ErrorType extends unknown,
  OkType extends unknown,
  RollbackFn extends RollbackFunction
> extends Base<ErrorType, OkType, RollbackFn> {
  public readonly error: ErrorType;

  constructor(err: ErrorType, rollbackFn?: RollbackFn) {
    super(rollbackFn);
    this.error = err;
  }

  isSuccess(): this is Ok<ErrorType, OkType, RollbackFn> {
    return false;
  }

  isFailure(): this is Err<ErrorType, OkType, RollbackFn> {
    return true;
  }

  toString(): string {
    return `Result.Error(${this.error})`;
  }

  /**
   * **Creates and forwards a brand new Result out of the current error or value **
   */
  forward(): Result<ErrorType, unknown, RollbackFn> {
    return Result.error(this.error);
  }
}
