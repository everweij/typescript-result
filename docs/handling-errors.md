# Handling errors

::: info
Make sure to read the [a note on errors](/a-note-on-errors.md) before diving into this section.
:::

So, you ended up with a nice `Result` instance with various error types. But how do you handle these errors effectively? We already saw how we can [unwrap](/unwrapping-a-result) a result to access the encapsulated value or error. Doing something useful with the value seems straightforward, but what about the error?

## `switch` is your friend

Until javascript introduces [pattern matching](https://github.com/tc39/proposal-pattern-matching) often a good 'ol `switch` does the trick remarkably well. It allows you to handle different error types in a clean and structured way. Here's an example:

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
  if (error.type === "error-a") {
    console.error("Error A occurred:", error.message);
  } else if (error.type === "error-b") {
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