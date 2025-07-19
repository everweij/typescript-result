# Handling errors

::: info
Make sure to read the [a note on errors](/a-note-on-errors.md) before diving into this section.
:::

So, you ended up with a nice `Result` instance with various error types. But how do you handle these errors effectively? We already saw how we can [unwrap](/unwrapping-a-result) a result to access the encapsulated value or error. Doing something useful with the value seems straightforward, but what about the error?

## Using `match()`

For most error handling scenarios, the `match()` method is your best friend. It allows you to handle different error types in a clean and structured way, with exhaustive checks already baked-in. Here's an example:

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

if (!result.ok) {
  result
    .match()
    .when(ErrorA, (error) => console.error("Error A:", error.message))
    .when(ErrorB, (error) => console.error("Error B:", error.message))
    .run();
} else {
  console.log("Everything went fine:", result.value);
}
```

As you can see, `when` allows you to specify a handler for specific cases, and `run()` executes the matched handler.

The `when` method takes either a class constructor for a specific error type (useful for class-based errors) or any other value that represents your errors (e.g. string contants, enums, etc.).

In the example above, we are simple logging the error message, but often you will want to return some kind of value, e.g. a http error response. `match()` will return a union type of all the handler's return types:

```ts twoslash
import { Result } from "typescript-result";

class UserNotFoundError extends Error {
  readonly type = "user-not-found-error";
}
class ValidationError extends Error {
  readonly type = "validation-error";
}
type User = { id: number };
// ---cut-before---
declare const result: Result<User, UserNotFoundError | ValidationError>;

function routeHandler() {
  if (!result.ok) {
    return result
      .match()
      .when(UserNotFoundError, (error) => ({
        status: 404,
        body: { error: error.type },
      } as const))
      .when(ValidationError, (error) => ({
        status: 400,
        body: { error: error.type, message: error.message },
      } as const))
      .run();
  }

  return {
    status: 200,
    body: result.value,
  } as const;
}
```

::: warning

You can only use `match()` on a `Result` instance that has been narrowed to a _failure_. In other words, you must first ensure that the result is not ok, otherwise TypeScript will give you an error:


```ts twoslash
// @errors: 2339
import { Result } from "typescript-result";

class ErrorA extends Error {
  readonly type = "error-a";
}
class ErrorB extends Error {
  readonly type = "error-b";
}

// ---cut-before---
declare const result: Result<string, ErrorA | ErrorB>;

// We did not check `result.ok` first, so TypeScript will complain:
result.match().when()
```

:::

### Auto exhaustive checks

The nice thing about `match()` is that it automatically checks if you've handled all possible error cases. If you forget to handle a specific error type, TypeScript will give you an error at compile time (or an exception is thrown at runtime):

```ts twoslash
// @errors: 2349
import { Result } from "typescript-result";

class ErrorA extends Error {
  readonly type = "error-a";
}
class ErrorB extends Error {
  readonly type = "error-b";
}

// ---cut-before---
declare const result: Result<string, ErrorA | ErrorB>;

if (!result.ok) {
  result
    .match()
    .when(ErrorA, (error) => console.error("Error A:", error.message))
    .run();
} else {
  console.log("Everything went fine:", result.value);
}
```

As you can see, TypeScript informs us that we forgot to handle `ErrorB`. This is a great way to ensure that your error handling is complete and that you don't accidentally miss any error cases.

### Multiple error types for a single handler

With `switch` statements you can group `case`s together. You can do the same with `when` by passing multiple error types as arguments. The last argument should always be the handler function:

```ts twoslash
import { Result } from "typescript-result";

class ErrorA extends Error {
  readonly type = "error-a";
}
class ErrorB extends Error {
  readonly type = "error-b";
}
class ErrorC extends Error {
  readonly type = "error-c";
}

// ---cut-before---
declare const result: Result<string, ErrorA | ErrorB | ErrorC>;

if (!result.ok) {
  result
    .match()
    // Handle ErrorA and ErrorB with the same handler
    .when(ErrorA, ErrorB, () => console.error("Error A or B"))
    .when(ErrorC, () => console.error("Error C"))
    .run();
} else {
  console.log("Everything went fine:", result.value);
}
```

### Fallback behavior with `else()`

If you want to handle the case where none of the specified error types match, you can use the `else()` method. This is useful for handling fallback behavior for instance:

```ts twoslash
import { Result } from "typescript-result";

class ErrorA extends Error {
  readonly type = "error-a";
}
class ErrorB extends Error {
  readonly type = "error-b";
}
class ErrorC extends Error {
  readonly type = "error-c";
}

// ---cut-before---
declare const result: Result<string, ErrorA | ErrorB | ErrorC>;

if (!result.ok) {
  result
    .match()
    .when(ErrorA, () => console.error("Error A"))
    .when(ErrorB, () => console.error("Error B"))
    .else((error) => console.error("Other error:", error))
    .run();
} else {
  console.log("Everything went fine:", result.value);
}
```

::: info

There are two things to be aware of when using `else()`:

- You can only use `else()` _once_. A second call to `else()` will result in both a compile and runtime error.
- If you already have handled all error cases, you don't need to use `else()`, and to keep things concise, TypeScript will complain that the `else()` clause is unnecessary and probably a mistake:

```ts twoslash
// @errors: 2349 7006
import { Result } from "typescript-result";

class ErrorA extends Error {
  readonly type = "error-a";
}
class ErrorB extends Error {
  readonly type = "error-b";
}

// ---cut-before---
declare const result: Result<string, ErrorA | ErrorB>;

if (!result.ok) {
  result
    .match()
    .when(ErrorA, () => console.error("Error A"))
    .when(ErrorB, () => console.error("Error B"))
    .else(() => console.error("Other error"))
    .run();
} else {
  console.log("Everything went fine:", result.value);
}

```
:::

### Async callbacks

`match()` will return a promise if any of the provided handler callbacks are async:

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

if (!result.ok) {
  await result
//^^^^^  
    .match()
    .when(ErrorA, async (error) => {
      //          ^^^^^
      // do something async...
      console.error("Error A:", error.message);
    })
    .when(ErrorB, (error) => console.error("Error B:", error.message))
    .run();
} else {
  console.log("Everything went fine:", result.value);
}
```

## Pattern matching libraries like `ts-pattern`

If you have more complex error handling needs, you might want to consider using a pattern matching library like [ts-pattern](https://github.com/gvergnaud/ts-pattern). These libraries provide a more powerful and flexible way to handle errors, allowing you to match on complex patterns and extract values and errors from your results.

Here's an example of how you can use `ts-pattern` to handle errors:

```ts twoslash
import { match, P } from "ts-pattern";
import { Result } from "typescript-result";
// ---cut-start---
class ErrorA extends Error {
  readonly type = "error-a";
}
class ErrorB extends Error {
  readonly type = "error-b";
}
// ---cut-end---

declare const result: Result<string, ErrorA | ErrorB>;

// only match on success or failure
match(result)
  .with({ ok: false }, ({ error }) => console.log("Error:", error))
  .with({ ok: true }, ({ value }) => console.log("Success:", value))
  .exhaustive();

// match on specific error types
match(result)
	.with({ error: P.instanceOf(ErrorA) }, ({ error }) =>
		console.log("Handled ErrorA:", error),
	)
	.with({ error: P.instanceOf(ErrorB) }, ({ error }) =>
		console.log("Handled ErrorB:", error),
	)
	.with({ ok: true }, ({ value }) => console.log("Handled success:", value))
	.exhaustive();

// handling errors only
if (!result.ok) {
  match(result.error)
    .with(P.instanceOf(ErrorA), (error) => console.error("Error A:", error.message))
    .with(P.instanceOf(ErrorB), (error) => console.error("Error B:", error.message))
    .exhaustive();
} else {
  console.log("Everything went fine:", result.value);
}

```


## `switch` or `if/else` can also be your friend

Until javascript introduces [pattern matching](https://github.com/tc39/proposal-pattern-matching) and you really want to use native language feature, often a good 'ol `switch` does the trick remarkably well. It allows you to handle different error types in a clean and structured way. Here's an example:

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

const [value, error] = result.toTuple();

if (error) {
  switch (error.type) {
    case "error-a":
      console.error("Error A occurred:", error.message);
      //                                 ^?
      break;
    case "error-b":
      console.error("Error B occurred:", error.message);
      //                                 ^?
      break;
  }
} else {
  console.log("Value:", value);
}
```

Notice how we use the discriminant property `type` to differentiate between the error types. Using this, TypeScript can narrow down the type of `error` within each case block, allowing you to access properties specific to that error type.

Of course this isn't limited to `switch` statements. You can also use `if` statements to check for specific error types:

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

const [value, error] = result.toTuple();

if (error) {
  if (error instanceof ErrorA) {
    console.error("Error A occurred:", error.message);
  } else if (error instanceof ErrorB) {
    console.error("Error B occurred:", error.message);
  }
} else {
  console.log("Value:", value);
}
```

## Exhaustive checks

How do you ensure that you've handled all possible error types? TypeScript's type system can help you with this. Sometimes out-of-the-box, and sometimes you have to do a bit yourself.

::: tip
Unless you have a good reason to do otherwise, we recommend to _avoid_ using `default` clauses in your `switch` statements, or `else` clauses in your `if` statements. Here's why:
- They can lead to overlooking errors that you didn't explicitly handle.
- If later down the line your logic introduces a new error type, the `default` or `else` clause will (unintentionally) catch it, potentially leading to unexpected behavior.

With statements you can group error cases together, so this somewhat relieves the pain of having to handle every single error type separately.
:::

### `noImplicitReturn`

If you have the `noImplicitReturn` compiler option enabled, TypeScript will enforce that all code paths in a function return a value. This means that if you have a `switch` statement that handles all possible error types, TypeScript will ensure that you have a return statement for every case, preventing accidental fall-through.

::: info
`noImplicitReturn` automatically is enabled when you use the `strict` compiler option.
:::

```ts twoslash
// @errors: 7030
import { Result } from "typescript-result";

class ErrorA extends Error {
  readonly type = "error-a";
}
class ErrorB extends Error {
  readonly type = "error-b";
}

// ---cut-before---
declare const result: Result<string, ErrorA | ErrorB>;

const output = result.getOrElse((error) => {
  switch (error.type) {
    case "error-a":
      return "Fallback for Error A";
    // we forgot to handle ErrorB
  }
}
)
```

Unfortunately, this only works in places where we can return a value.

### `assertUnreachable`

This library exports a little utility function called `assertUnreachable` that can help you ensure that you've handled all possible error types. It throws an error if it is called, which will happen if you forget to handle a specific error type in a `switch` statement or `if` statement:

::: code-group

```ts twoslash [Switch]
// @errors: 2345
import { Result, assertUnreachable } from "typescript-result";
// ---cut-start---
class ErrorA extends Error {
  readonly type = "error-a";
}
class ErrorB extends Error {
  readonly type = "error-b";
}

// ---cut-end---
declare const result: Result<string, ErrorA | ErrorB>;

const [value, error] = result.toTuple();

if (error) {
  switch (error.type) {
    case "error-a":
      console.error("Error A occurred:", error.message);
      break;
    default:
      assertUnreachable(error);
  }
} else {
  console.log("Value:", value);
}
```


```ts twoslash [If/Else]
// @errors: 2345
import { Result, assertUnreachable } from "typescript-result";
// ---cut-start---
class ErrorA extends Error {
  readonly type = "error-a";
}
class ErrorB extends Error {
  readonly type = "error-b";
}

// ---cut-end---
declare const result: Result<string, ErrorA | ErrorB>;

const [value, error] = result.toTuple();

if (error) {
  if (error.type === "error-a") {
    console.error("Error A occurred:", error.message);
  } else {
    assertUnreachable(error);
  }
} else {
  console.log("Value:", value);
}
```

:::