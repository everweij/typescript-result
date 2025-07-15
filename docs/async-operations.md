# Async operations

Existing Result implementations often face criticism for poor asynchronous operation support. The example below demonstrates how quickly things can become unwieldy:

```ts
async function operationA() {
  return Math.random() > 0.5
    ? Result.ok("Operation A succeeded")
    : Result.error(new ErrorA("Operation A failed")); 
}

async function operationB() {
  return Math.random() > 0.5
    ? Result.ok("Operation B succeeded")
    : Result.error(new ErrorB("Operation B failed"));
}

const result = await (await operationA()).map(async () => {
  /* some logic here */
  return (await operationB()).map(() => "Final result");
});
```

Luckily, TypeScript Result offers first class support for asynchronous operations.

## A box within a box

In JavaScript/TypeScript, an async function always returns a `Promise`. If that function happens to return a `Result`, it will return a `Promise<Result<...>>`, hence the term "box within a box": we need to unwrap two layers in order to get to the actual value or error. As can be seen in the previous example, this is not very ergonomic and quickly leads to unreadable code.

## One box to rule them all

To solve this problem, TypeScript Result has the `AsyncResult` type.

> Instead of two nested 'boxes', we combine the `Promise` and `Result` into a single type: `AsyncResult`.

::: info

This is really the case under the hood: `AsyncResult` _is_ a `Promise` that holds a `Result`, along with the same methods (e.g. `map`, `toTuple`, etc.) a regular `Result` has.

:::

## `Result.fromAsync`

Most operations on the Result instance already automatically turn async operations into `AsyncResult` instances, so you don't have to worry about it:

```ts
declare const result: Result<string, Error>;

const nextResult = result.map(async (value) => {
  await sleep(1000); // Simulating an async operation
  return value.toUpperCase();
}): // AsyncResult<string, Error>
```

However, there's one use case that is impossible to handle automatically: functions returning a `Promise<Result<...>>`. This is where the `Result.fromAsync` method comes in handy.

There are two approaches you can choose from: transform to an `AsyncResult` _directly at the source_, or let the _consuming code_ handle the conversion. Let's look at both approaches in more detail.

::: code-group

```ts twoslash [Directly at the source]
import { Result } from "typescript-result";

class ErrorA extends Error {
  readonly type = "error-a";
}

class ErrorB extends Error {
  readonly type = "error-b";
}
// ---cut-before---
function operationA() {
  return Result.fromAsync(async () =>
    Math.random() > 0.5
      ? Result.ok("Operation A succeeded")
      : Result.error(new ErrorA("Operation A failed"))
  );
}

function operationB() {
  return Result.fromAsync(async () =>
    Math.random() > 0.5
      ? Result.ok("Operation B succeeded")
      : Result.error(new ErrorB("Operation B failed"))
  );
}

const result = await operationA().map(() => {
  /* some logic here */
  return operationB().map(() => "Final result");
});
```

```ts twoslash [Consuming code]
import { Result } from "typescript-result";

class ErrorA extends Error {
  readonly type = "error-a";
}

class ErrorB extends Error {
  readonly type = "error-b";
}
// ---cut-before---
async function operationA() {
  Math.random() > 0.5
    ? Result.ok("Operation A succeeded")
    : Result.error(new ErrorA("Operation A failed"))
}

async function operationB() {
  Math.random() > 0.5
    ? Result.ok("Operation B succeeded")
    : Result.error(new ErrorB("Operation B failed"))
}

const result = await Result.fromAsync(operationA()).map(() => {
  /* some logic here */
  return Result.fromAsync(operationB()).map(() => "Final result");
});

```

:::

Both approaches work. We recommend to pick the _'directly at the source'_ approach, mainly because it plays nicer in conjunction with [generators](/chaining-vs-generator-syntax#using-generators):

```ts twoslash
import { Result } from "typescript-result";

class ErrorA extends Error {
  readonly type = "error-a";
}

class ErrorB extends Error {
  readonly type = "error-b";
}

function operationA() {
  return Result.fromAsync(async () =>
    Math.random() > 0.5
      ? Result.ok("Operation A succeeded")
      : Result.error(new ErrorA("Operation A failed"))
  );
}

function operationB() {
  return Result.fromAsync(async () =>
    Math.random() > 0.5
      ? Result.ok("Operation B succeeded")
      : Result.error(new ErrorB("Operation B failed"))
  );
}

// ---cut-before---
const result = Result.gen(function* () {
  yield* operationA();
  /* some logic here */
  yield* operationB();
  return "Final result";
});

```

