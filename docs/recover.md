# Recover

> `recover` is used to transform the _error_ of a `Result` or `AsyncResult` into a next `Result` or `AsyncResult`.

`recover` is especially useful when you want to fall back to another scenario when a previous operation fails. In the example below, we try to persist an item in the database. If that fails, we fall back to persisting the item locally.

```ts twoslash
import { Result } from "typescript-result";

type Item = { id: number; name: string; };

class DbError extends Error {
  readonly type = "db-error";
}

class IOError extends Error {
  readonly type = "io-error";
}
// ---cut-before---
declare function persistInDB(item: Item): Result<void, DbError>;

declare function persistLocally(item: Item): Result<void, IOError>;

const item: Item = { id: 1, name: "Item 1" };

const result = persistInDB(item)
  .recover(() => persistLocally(item));
```

::: info
Note that after a recovery, any previous errors that might have occurred are _forgotten_. This is because when using `recover` you are essentially starting with a clean slate. In the example above we can assume that the `DbError` has been taken care of and therefore it has been removed from the final result. `IOError` on te other hand is still a possibility because it might occur after the recovery.
:::

::: tip

If you only want to recover from a specific error, you have two options:

**Conditionally recover**

```ts
declare const result: Result<string, DbError | NetworkError>;

const nextResult = result.recover((error) => {
  if (error.type === "db-error") {
    return persistLocally(); // Result<void, IOError>
  }

  return error // Result<void, NetworkError>;
}); // Result<string, IOError | NetworkError>;
```

**Nesting**

```ts
declare const result: Result<string, NetworkError>;
declare const otherResult: Result<string, DbError>;

const nextResult = result.map(() => 
  otherResult.recover(() => 
    persistLocally() // Result<void, IOError>
  )
); // Result<string, IOError | NetworkError>;
```



:::

## Polymorphic

Just like `map`, the `recover` method is very flexible when it comes to the return type of the callback. You can return a `Result`, `AsyncResult`, `Promise`, or even a generator function.

## Catch thrown exceptions

Just like `mapCatching`, there's a `recoverCatching` variant that allows you to catch exceptions thrown by the callback function. This is useful when you want to handle errors that might occur during the recovery process: