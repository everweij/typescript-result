# `map`

> `map` is used to transform the _value_ of a `Result` or `AsyncResult` into a next `Result` or `AsyncResult`.

Conceptually, `map` is similar to the `Array.prototype.map` method, but in our case, it operates on the success value of a `Result` or `AsyncResult`. If the `Result` is a failure, the `map` function will not be called, and the failure will be passed through unchanged.

```ts twoslash
import { Result } from "typescript-result";
// ---cut-before---
declare const result: Result<number, Error>;

const nextResult = result.map(value => value * 2);
```

## Polymorphic

The `map` method is very flexible when it comes to the return type of the callback. To illustrate this, consider the following example:

```ts twoslash
import { Result } from "typescript-result";

declare function someOperation(): Result<number, Error>;
// ---cut-before---
declare const result: Result<number, Error>;

const nextResult = result // Result<number, Error>
  .map((value) => value * 2) // Result<number, Error> 
  .map((value) => Result.ok(value * 2)) // Result<number, Error>
  .map((value) => Promise.resolve(value * 2)) // AsyncResult<number, Error>
  .map(async (value) => value * 2) // AsyncResult<number, Error>
  .map(async (value) => Result.ok(value * 2)) // AsyncResult<number, Error>
  .map(function* (value) {
    const other = yield* someOperation();
    return value * other;
  }); // AsyncResult<number, Error>

```

## Nesting

Sometimes nesting `map` calls can become inevitable, for example when you need a reference to an earlier value in the chain. This is perfectly fine, as `map` automatically flattens other `Result` or `AsyncResult` values, but be careful not to overuse this pattern, as it can lead to less readable code. Here's an example of how you might use nested `map` calls:

```ts twoslash
import { Result } from "typescript-result";

declare function getValueA(): Result<number, Error>;
declare function getValueB(): Result<number, Error>;

const result = getValueA()
  .map((a) => 
    getValueB()
      .map((b) => a + b)
  );

```

## Catch thrown exceptions

There's also a `mapCatching` variant that allows you to catch exceptions thrown by the callback function. This is useful when you want to handle errors that might occur during the transformation process:

```ts twoslash
import { Result } from "typescript-result";
declare const result: Result<string, Error>;
type Data = { id: number; };
class ParseError extends Error {
  readonly type = "parse-error";
}
// ---cut-before---
const nextResult = result.mapCatching(
  (value) => JSON.parse(value) as Data, // This might throw an error
  (error) => new ParseError("Failed to parse JSON", { cause: error }),
);
```