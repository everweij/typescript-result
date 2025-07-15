# Unwrapping a Result

At some point in the flow of your program, you want to retrieve the value of a successful result or the error of a failed result. There are a couple of ways to do this, depending on your use case.

## Narrowing the Result using `isOk()` or `isError()`

The most basic and imperative approach is to use the `isOk()` and `isError()` methods to narrow down the type of the result, and use the `value` or `error` getters to retrieve the value or error.

::: info
You can access the `value` and `error` properties directly, but this is not recommended as it does not narrow the type of the result; it might add `undefined` to the type because TS cannot guarantee that the result is successful or failed.

However, you can access the `value` and `error` properties directly if TS knows for sure that the result is successful or failed.
:::

```ts twoslash
import { Result } from "typescript-result";

class ErrorA extends Error {
  readonly type = "error-a";
}
class ErrorB extends Error {
  readonly type = "error-b";
}
// ---cut-before---
declare const result: Result<string, ErrorA | ErrorB>;

result.value; // string | undefined
result.error; // ErrorA | ErrorB | undefined

if (result.isOk()) {
  result.value; // must be string
} else {
  result.error; // must be ErrorA | ErrorB
}
```

## Using `toTuple()`

`toTuple()` returns the result in a tuple format where the first element is the _value_ and the second element is the _error_. We can leverage TypeScript's narrowing capabilities to infer the correct type of the value or error by doing a simple conditional check:

```ts twoslash
import { Result } from "typescript-result";

type Data = { id: number; }

class IOError extends Error {
  readonly type = "io-error";
}
// ---cut-before---
declare const result: Result<Data, IOError>;

const [value, error] = result.toTuple();

if (value) {
  value; // at this point the value must be Data
} else {
  error; // error must be an instance of IOError
}
```

Another common approach is to return early when the result is a failure.

```ts twoslash
import { Result } from "typescript-result";

type Data = { id: number; }

class IOError extends Error {
  readonly type = "io-error";
}

// ---cut-before---
declare const result: Result<Data, IOError>;

function app() {
  const [value, error] = result.toTuple();
  
  if (error) {
    // Handle the error here
    return;
  }
  
  // Do something with the value here
  return console.log("Success:", value);
}
```

## Folding a result using `fold`

The `fold` method is a more functional approach to unwrapping a result. It allows you to provide two callbacks: one for the successful case and one for the failure case. The `fold` method will execute the appropriate callback based on the outcome of the result. Using `fold` is especially useful when you want to return the a single 'thing' based on the outcome of the result, for example when you want to return a response object:

```ts twoslash
import { Result, AsyncResult } from "typescript-result";

class NotFoundError extends Error {
  readonly type = "not-found";
}
class UnauthorizedError extends Error {
  readonly type = "unauthorized";
}
class UnknownError extends Error {
  readonly type = "unknown";
}

type Data = { id: number; }

declare const performOperation: (id: number) => AsyncResult<Data, NotFoundError | UnauthorizedError | UnknownError>;

// ---cut-before---
async function handleRoute(id: number) {
  const result = await performOperation(id);

  return result.fold(
    (value) => ({
      status: 200,
      body: value,
    } as const),
    (error) => {
      switch (error.type) {
        case "not-found":
          return {
            status: 404,
            body: `Not found: ${error.message}`,
          } as const;
        case "unauthorized":
          return {
            status: 401,
            body: `Unauthorized: ${error.message}`,
          } as const;
        default:
          return {
            status: 500,
            body: `Internal server error: ${error.message}`,
          } as const;
      }
    }
  )
}
```

::: info

It is also valid to use async callbacks with `fold`:

```ts
declare const result: Result<Data, FetchError | IOError>;

result.fold(
  async () => {
    // Handle the success case

    return { ok: true, body: "Success" };
  },
  async (error) => {
    // Handle the error cases
    return { ok: false, body: "An error!" };
  }
); // returns a Promise<{ ok: boolean; body: string; }>
```

:::

## Using 'getters'

### getOrNull()

The `getOrNull()` method returns the value if the result is successful, or `null` if it represents a failure.

```ts
declare const result: Result<Data, IOError>;

const value = result.getOrNull(); // Data | null
```

### getOrDefault()

Returns the value if the result is successful, or a default value if it represents a failure.

```ts
declare const result: Result<Data, IOError>;

const value = result.getOrDefault({ id: 0 }) // Data
```

### getOrElse()

The `getOrElse()` method returns the value if the result is successful, or the result of a callback function if it represents a failure. This is useful when you want to compute a fallback value dynamically.



```ts
declare const result: Result<Data, IOError>;

const value = result.getOrElse(() => {
  // Compute a fallback value
  return { id: 0 };
}); // Data
```

::: info
The callback function can be async as well, in which case the method will return a `Promise` that resolves to the value or the result of the callback.

```ts
declare const result: Result<Data, IOError>;

const value = await result.getOrElse(async () => {
  /* computational heavy operation */

  return { id: 0 };
}); // Data
```
:::

### getOrThrow()

The `getOrThrow()` method returns the value if the result is successful, or throws the error if it represents a failure.

::: danger
This is considered an anti-pattern, since it ignores any active error handling. Use with caution.
:::

```ts
declare const result: Result<Data, IOError>;

const value = result.getOrThrow(); // Data
```