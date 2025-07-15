# A note on errors

::: info
TL;DR: _tag_ your custom errors with a `readonly type` property to avoid TypeScript unifying them into a single `Error` type, like so:

```typescript
class CustomError extends Error {
  readonly type = "custom-error";
}
```
:::

## Subclass `Error`

Although you are free to use any type of value to represent an error, we recommend to stick with 'regular' `Error` subclasses. Here's why:
- This is the most common way to represent errors in JavaScript and TypeScript, so it will be _familiar_ to most developers.
- Existing codebases often already make use of regular errors, so by embracing this convention, it will be easier to adopt this library in existing projects.
- It is not only useful to know which error occurred, but also get more context about the error, like _where_ it happened. Native `Error` objects provide a stack trace, which can be very helpful for debugging.

## Tagging

There's one thing to keep in mind when it comes to using custom errors that extends the `Error` class: in certain circumstances, like inferring errors of a result type, TypeScript tends to unify types that look similar. This means that in the example below, TypeScript will infer the error type of the result to be `ErrorA` instead of `ErrorA | ErrorB`. This happens because TypeScript uses [structural typing](https://www.typescriptlang.org/docs/handbook/type-compatibility.html) - types are compatible if they have the same structure. Since both error classes have identical members (inherited from `Error`), TypeScript cannot distinguish between them and merges them into a single type.

```typescript twoslash
import { Result } from "typescript-result";
// ---cut-before---
class ErrorA extends Error {}
class ErrorB extends Error {}

function someOperation() {
  if (Math.random() > 0.5) {
    return Result.error(new ErrorA());
  }

  return Result.error(new ErrorB());
}

const result = someOperation();
//             ^?
```

To mitigate this, you can add a property on your custom errors, a so-called discriminant property, that makes it easier for TypeScript to distinguish between the different error types. In the example below, TypeScript will infer the error type of the result to be `ErrorA | ErrorB`:

```typescript twoslash
import { Result } from "typescript-result";
// ---cut-before---
class ErrorA extends Error {
  readonly type = "error-a"; // [!code ++]
}
class ErrorB extends Error {
  readonly type = "error-b"; // [!code ++]
}

function someOperation() {
  if (Math.random() > 0.5) {
    return Result.error(new ErrorA());
  }

  return Result.error(new ErrorB());
}

const result = someOperation();
//             ^?
```

::: info
We've chosen the name `type` for the discriminant property, but you can use any name you like. The important part is that it is a `readonly` property, so TypeScript can use it to distinguish between different error types.
:::

## Expected vs. unexpected errors

While it's possible to wrap every error in a result type, this isn't always the best approach. Not every error deserves to be encapsulated in a result. So, which errors should you handle with results?

### Excpected errors

Expected errors (also called failures, typed errors, or recoverable errors) are errors that developers anticipate during normal program execution. Like checked exceptions (Java ™️), they're part of your program's domain and control flow, helping define how your application handles predictable failure scenarios.

Although it may vary from project to project, expected errors typically include things like:
- Validation errors (e.g., user input validation)
- Business logic errors (e.g., insufficient stock, user not found)

### Unexpected errors

Unexpected errors (also called defects, untyped errors, or unrecoverable errors) are errors that developers don't anticipate during normal program execution. Unlike expected errors, these resemble unchecked exceptions and fall outside your program's intended domain and control flow.

These errors are often caused by bugs in the code, unexpected external conditions, or system failures. Examples include:
- Network failures (e.g., server not reachable)
- Database errors (e.g., connection lost)

### Recommended approach

In general, we recommend to use result types for expected errors, and to `throw` unexpected errors. This way, you can handle expected errors in a structured way, while still being able to catch unexpected errors using a `try/catch` block. Depending on the type of program you're building, it may be wise to register a global error handler to catch unexpected errors and log them, return a `500` status code, or exit the program entirely (panic).