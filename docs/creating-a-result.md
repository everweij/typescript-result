# Creating a Result

## `Result.ok` and `Result.error`

The most common way to create a result is by using the `Result.ok` and `Result.error` methods.

The example below produces a result which contains either the outcome of the division or an `IllegalArgumentError` error.

```ts twoslash
import { Result } from "typescript-result";

class IllegalArgumentError extends Error {
  readonly type = "illegal-argument-error";
}

function divide(a: number, b: number) {
  if (b === 0) {
    return Result.error(new IllegalArgumentError(`Cannot divide ${a} by zero`));
  }

  return Result.ok(a / b);
}
```

Note that we didn't specify an explicit return type for the `divide` function. In most cases TypeScript is smart enough to infer the result types for you. In case of the example above, the return type gets inferred to `Result<number, IllegalArgumentError>`. Although generally there are good reasons to specify the return type explicitly (e.g. clarity, readability, etc.), **the recommended way is to use the implicit approach (type inference)**.

::: info
Note that when using `Result.ok` it is optional to provide a value, simply because not all operations produce a value.

```ts
// this is fine
const result = Result.ok(); // Result.Ok<void>
```
:::


## `Result.try` and `Result.wrap`

### `Result.try`

[`Result.try`](#resulttryfn-transform) is a convenient way to wrap code that might throw an error. The method will catch any exceptions that might be thrown and encapsulate them in a failed result. This is especially useful when you want to work with existing or external functions that might throw exceptions. You can often replace traditional try-catch blocks by wrapping the code in `Result.try`:

```ts
// Using try-catch
let result: Result<void, Error>;
try {
  fs.writeFileSync("file.txt", "Hello, World!", "utf-8");
  result = Result.ok();
} catch (error) {
  result = Result.error(error);
}

// Using Result.try
const result = Result.try(
  () => fs.writeFileSync("file.txt", "Hello, World!", "utf-8")
);
```

Here, we are using Node's built-in `fs` module to write a file to disk. The `writeFileSync` method might throw an error if something goes wrong. You might not have the correct permissions for instance, or you ran out of disk space. By using `Result.try`, we can catch the error and encapsulate it in a failed result.

Optionally, you can provide a second argument to `Result.try` which is a callback that allows you to transform the caught error into a more meaningful error. This is useful when you want to provide more context or when you want to wrap the error in a custom error type.

```ts {3}
const result = Result.try(
  () => fs.writeFileSync("file.txt", "Hello, World!", "utf-8"),
  (error) => new IOError("Failed to save file", { cause: error }),
);
```

### `Result.wrap`

Additionally, you can use `Result.wrap` to wrap a function and return a new function that returns a result. The main difference compared to `Result.try` is that `Result.wrap` returns a function, while `Result.try` executes the function immediately. 

```ts
const safeWriteFile = Result.wrap(fs.writeFileSync);

const result = safeWriteFile("file.txt", "Hello, World!", "utf-8");
// Result<void, Error>
```

Just like `Result.try`, you can also provide a second argument to `Result.wrap` to transform the caught error into a more meaningful error.

```ts {3}
const safeWriteFile = Result.wrap(
  fs.writeFileSync,
  (error) => new IOError("Failed to save file", { cause: error }),
);
```

### Async try/wrap

Because of the polymorphic nature of this library, you can also use `Result.try` and `Result.wrap` with asynchronous functions (and even functions that return other `Result`/`AsyncResult` instances):

```typescript twoslash
import { Result } from "typescript-result";

type Data = { id: number };

class FetchError extends Error {
  readonly type = "fetch-error";
}

// ---cut-before---
const result = Result.try(
  async () => {
    const response = await fetch("https://api.example.com/data");
    if (!response.ok) {
      throw new Error("response was not ok");
    }

    const data = await response.json() as Data;
    return data;
  },
  (error) => new FetchError("Failed to fetch data", { cause: error }),
);
```

## `Result.gen` and `Result.genCatching`

This method takes a generator (or callback that returns a generator) and transforms it into a `Result` or `AsyncResult`. The `genCatching` variant does exactly the same as `gen`, but it catches any errors that might be thrown during the execution of the generator and encapsulates them in a failed result. Like `Result.try` it accepts a second argument to transform the caught error into a more meaningful error.

::: info
See [Chaining vs. generator syntax](/chaining-vs-generator-syntax#using-generators) for more information on how to use generator functions with `Result`.
:::

## `Result.fromAsync` and `Result.fromAsyncCatching`

These methods are used to create a `Result` or `AsyncResult` from an asynchronous function or promise. The `fromAsyncCatching` variant catches any errors that might be thrown during the execution of the asynchronous function and encapsulates them in a failed result. Like `Result.try`, it accepts a second argument to transform the caught error into a more meaningful error.

::: info
See [Async operations](/async-operations) for more information on how effectively work with async operations.
:::