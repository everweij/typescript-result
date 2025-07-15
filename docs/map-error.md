# `mapError`

> `mapError` is used to transform an _error_ of a `Result` or `AsyncResult` into a next `Result` or `AsyncResult`.

This is especially useful when you want to transform the error into a different error type, or when you want to provide more context to the error:

```ts twoslash
import { Result, AsyncResult } from "typescript-result";

type User = { id: number; name: string; };

class NotFoundError extends Error {
  readonly type = "not-found";
}

class NotAllowedError extends Error {
  readonly type = "not-allowed";
}
// ---cut-before---
declare function findUserById(id: number): AsyncResult<User, NotFoundError>;

const result = findUserById(1)
  .mapError(() => 
    new NotAllowedError("You are not allowed to perform this action.")
  );
```

In the example above `mapError` is used to transform the `NotFoundError` into a `NotAllowedError`, which makes more sense in the context of checking user permissions.

::: info
Be careful: `mapError` will override any previous error that was captured in the chain.

Sometimes this may be exactly what you want, e.g. when bundling multiple errors into a single error type:

```ts
declare result: Result<string, FileNotExistsError | FilePermissionError>;

const nextResult = result.mapError((error) => 
  new IOError("An error occurred while processing the file.", { cause: error })
);
```

In other cases, you may want to target a specific error or case. There are two ways to handle this:

**Conditionally checking for errors**

```ts
declare result: Result<string, ErrorA | ErrorB>;

const nextResult = result.mapError((error) => {
  if (error.type === "error-a") {
    return new ErrorC();
  }

  return error;
}) // Result<string, ErrorB | ErrorC>;
```

**Nesting**

```ts
declare result: Result<string, ErrorA>;
declare otherResult: Result<string, ErrorB>;

const nextResult = result.map(value =>
  otherResult.mapError(() => new ErrorC()) // Result<string, ErrorC>
) // Result<string, ErrorA | ErrorC>;
```

The benefit of the latter approach is that the transformation is happening close to the source of the error, which can make the code more readable and maintainable.
:::