<img alt="TypeScript Result logo" width="84px" src="./assets/typescript-result-logo.svg" />

# TypeScript Result

[![NPM](https://img.shields.io/npm/v/typescript-result.svg)](https://www.npmjs.com/package/typescript-result)
[![TYPESCRIPT](https://img.shields.io/badge/%3C%2F%3E-typescript-blue)](http://www.typescriptlang.org/)
[![BUNDLEPHOBIA](https://badgen.net/bundlephobia/minzip/typescript-result)](https://bundlephobia.com/result?p=typescript-result)
[![Weekly downloads](https://badgen.net/npm/dw/typescript-result)](https://badgen.net/npm/dw/typescript-result)

A Result type inspired by Rust and Kotlin that leverages TypeScript's powerful type system to simplify error handling and make your code more readable and maintainable with full type safety.

## Table of contents

- [Getting started](#getting-started)
- [Why should you use a result type?](#why-should-you-use-a-result-type)
- [Why should you use this library?](#why-should-you-use-this-library)
- [Guide](#guide)
  - [A note on errors](#a-note-on-errors)
  - [Creating a result](#creating-a-result)
  - [Performing operations on a result](#performing-operations-on-a-result)
  - [Unwrapping a result](#unwrapping-a-result)
  - [Handling errors](#handling-errors)
  - [Async operations](#async-operations)
  - [Merging or combining results](#merging-or-combining-results)
- [API Reference](#api-reference)

## Getting started

### Installation

Install using your favorite package manager:

```bash
npm install typescript-result
```

### Requirements

#### Typescript

Technically Typescript with version `4.8.0` or higher should work, but we recommend using version >= `5` when possible.

Also it is important that you have `strict` or `strictNullChecks` enabled in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

#### Node

Tested with Node.js version `16` and higher.

### Example

Reading a JSON config file and validating its contents:

```typescript
import { Result } from "typescript-result";
import fs from "node:fs/promises";

class IOError extends Error {
  readonly type = "io-error";
}

class ParseError extends Error {
  readonly type = "parse-error";
}

class ValidationError extends Error {
  readonly type = "validation-error";
}

function readFile(path: string) {
  return Result.try(
    () => fs.readFile(path, "utf-8"),
    (error) => new IOError(`Unable to read file '${path}'`, { cause: error })
  );
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

function getConfig(value: unknown) {
  if (!isObject(value)) {
    return Result.error(new ValidationError("Invalid config file"));
  }
  if (!value.name || !isString(value.name)) {
    return Result.error(new ValidationError("Missing or invalid 'name' field"));
  }
  if (!value.version || !isString(value.version)) {
    return Result.error(
      new ValidationError("Missing or invalid 'version' field")
    );
  }

  return Result.ok({ name: value.name, version: value.version });
}

const message = await readFile("./config.json")
  .mapCatching(
    (contents) => JSON.parse(contents),
    (error) => new ParseError("Unable to parse JSON", { cause: error })
  )
  .map((json) => getConfig(json))
  .fold(
    (config) =>
      `Successfully read config: name => ${config.name}, version => ${config.version}`,

    (error) => {
      switch (error.type) {
        case "io-error":
          return "Please check if the config file exists and is readable";
        case "parse-error":
          return "Please check if the config file contains valid JSON";
        case "validation-error":
          return error.message;
      }
    }
  );
```

There's also an example repository available [here](https://github.com/everweij/typescript-result-example) that demonstrates how you could potentially use this library in the context of a web API.

## Why should you use a result type?

### Errors as values

The Result type is a product of the ‘error-as-value’ movement, which in turn has its roots in functional programming. When throwing exceptions, all errors are treated equally and behave differently compared to the normal flow of the program. Instead, we like to make a distinction between expected errors and unexpected errors, and make the expected errors part of the normal flow of the program. By explicitly defining that a piece of code can either fail or succeed using the Result type, we can leverage TypeScript's powerful type system to keep track of everything that can go wrong in our code, and let it correct us when we overlook certain scenarios by performing exhaustive checks. This makes our code more type-safe, easier to maintain, and more transparent.

### Ergonomic error handling

The goal is to keep the effort in using this library as light as possible, with a relatively small API surface. We don't want to introduce a whole new programming model where you would have to learn a ton of new concepts. Instead, we want to build on top of the existing features and best practices of the language, and provide a simple and intuitive API that is easy to understand and use. It also should be easy to incrementally adopt within existing codebase.

## Why should you use this library?

There are already a few quality libraries out there that provide a Result type or similar for TypeScript. We believe that there are two reasons why you should consider using this library.

### Async support

Result instances that are wrapped in a Promise can be painful to work with, because you would have to `await` every async operation before you can _chain_ next operations (like 'map', 'fold', etc.). To solve this and to make your code more ergonomic we provide an `AsyncResult` that is essentially a regular Promise containing a `Result` type, along with a couple of methods to make it easier to chain operations without having to assign the intermediate results to a variable or having to use `await` for each async operation.

So instead of writing:

```typescript
const firstAsyncResult = await someAsyncFunction1();
if (firstAsyncResult.isOk()) {
  const secondAsyncResult = await someAsyncFunction2(firstAsyncResult.value);
  if (secondAsyncResult.isOk()) {
    const thirdAsyncResult = await someAsyncFunction3(secondAsyncResult.value);
    if (thirdAsyncResult.isOk()) {
      // do something
    } else {
      // handle error
    }
  } else {
    // handle error
  }
} else {
  // handle error
}
```

You can write:

```typescript
const result = await Result.fromAsync(someAsyncFunction1())
  .map((value) => someAsyncFunction2(value))
  .map((value) => someAsyncFunction3(value))
  .fold(
    (value) => {
      // do something on success
    },
    (error) => {
      // handle error
    }
  );
```

You rarely have to deal with `AsyncResult` directly though, because this library will automatically convert the result of an async operation to an `AsyncResult` when needed, and since the API's are almost identical in shape, there's a big chance you wouldn't even notice you're using a `AsyncResult` under the hood. Let's look at an example what this means in practice:

```typescript
// start with a sync value -> Result<number, never>
const result = await Result.ok(12)
  // map the value to a Promise -> AsyncResult<number, never>
  .map((value) => Promise.resolve(value * 2)) // 
  // map async to another result -> AsyncResult<string, ValidationError>
  .map(async (value) => {
    if (value < 10) {
      return Result.error(new ValidationError("Value is too low"));
    }

    return Result.ok("All good!");
  })
  // unwrap the result -> Promise<string>;
  .getOrElse((error) => error.message);
```

### _Full_ type safety without a lot of boilerplate

This library is able to track all possible outcomes simply by using type inference. Of course, there are edge cases, but most of the time all you have to do is to simply return `Result.ok()` or `Result.error()`, and the library will do the rest for you.
In the example below, Typescript will complain that not all code paths return a value. Rightfully so, because we forgot to implement the case where there is not enough stock:

```typescript
class NotEnoughStockError extends Error {
  readonly type = "not-enough-stock";
}

class InsufficientBalanceError extends Error {
  readonly type = "insufficient-balance";
}

function order(basket: Basket, stock: Stock, account: Account) {
  if (basket.getTotalPrice() > account.balance) {
    return Result.error(new InsufficientBalanceError());
  }

  if (!stock.hasEnoughStock(basket.getProducts())) {
    return Result.error(new NotEnoughStockError());
  }

  const order: Order = { /* skipped for brevity */ }

  return Result.ok(order);
}

function handleOrder(products: Product[], userId: number) {
  /* skipped for brevity  */

  return order(basket, stock, account).fold(
    () => ({
      status: 200,
      body: "Order placed successfully",
    }),
    (error) => { // TS-Error: Not all code paths return a value
      switch(error.type) {
        case "insufficient-balance":
          return {
            status: 400,
            body: "Insufficient balance",
          }
      }
    }
  );
}
```

## Guide

### A note on errors

Errors are a fundamental part of the Result type. This library does not have a strong opinion on what your errors should look like; they can be any value, like a string, number, object, etc. Usually though, people tend to use instances of the `Error` class or any custom errors by subclassing the `Error` class.

There's only one thing to keep in mind when it comes to using custom errors that extends the `Error` class: in certain circumstances, like inferring errors of a result type, TypeScript tends to unify types that look similar. This means that in the example below, TypeScript will infer the error type of the result to be `Error` instead of `ErrorA | ErrorB`. This is because TypeScript does not have a way to distinguish between the two errors, since they are both instances of the `Error` class.

```typescript
class ErrorA extends Error {}
class ErrorB extends Error {}

function example() {
  if (condition) {
    return Result.error(new ErrorA());
  }

  return Result.error(new ErrorB());
}

const result = example();
if (result.isError()) {
  // TypeScript infers that result.error is of type Error, and not ErrorA | ErrorB
  console.error(result.error);
}
```

To mitigate this, you can add a property on your custom errors, a so-called discriminant field, that makes it easier for TypeScript to distinguish between the different error types. In the example below, TypeScript will infer the error type of the result to be `ErrorA | ErrorB`:

```typescript
class ErrorA extends Error {
  readonly type = "error-a";
}
class ErrorB extends Error {
  readonly type = "error-b";
}

function example() {
  if (condition) {
    return Result.error(new ErrorA());
  }

  return Result.error(new ErrorB());
}

const result = example();
if (result.isError()) {
  console.error(result.error); // ErrorA | ErrorB
}
```

Although we agree that this might be a bit cumbersome, it is a small price to pay for the benefits that you get in return. For consistency, we recommend to always add a `readonly type` property to your custom errors.

### Creating a result

#### Basic usage

The most common way to create a result is by using the [`Result.ok`](#resultokvalue) and [`Result.error`](#resulterrorerror) static methods.

The example below produces a result which contains either the outcome of the division or a `DivisionByZeroError` error.

```ts
function divide(a: number, b: number) {
  if (b === 0) {
    return Result.error(new DivisionByZeroError(`Cannot divide ${a} by zero`));
  }

  return Result.ok(a / b);
}
```

Note that we didn't specify an explicit return type for the `divide` function. In most cases TypeScript is smart enough to infer the result types most of the times for you. In case of the example above, the return type gets inferred to `Result<number, DivisionByZeroError>`. There are good reasons to specify the return type explicitly (e.g. clarity, readability, etc.), but in general it is not technically a necessity and therefore up to you to decide to define your returns explicit or not.

Also note that when using `Result.ok` it is optional to provide a value, simply because not all operations produce a value.

```ts
// this is fine
const result = Result.ok(); // Result<void, never>
```

#### Using `Result.try` and `Result.wrap`

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
const result = Result.try(() => fs.writeFileSync("file.txt", "Hello, World!", "utf-8"));
```

Here, we are using Node's `fs` module to write a file to disk. The `writeFileSync` method might throw an error if something goes wrong. You might not have the correct permissions for instance, or you ran out of disk space. By using `Result.try`, we can catch the error and encapsulate it in a failed result.

Optionally, you can provide a second argument to `Result.try` which is a callback that allows you to transform the caught error into a more meaningful error. This is useful when you want to provide more context or when you want to wrap the error in a custom error type.

```ts
const result = Result.try(
	() => fs.writeFileSync("file.txt", "Hello, World!", "utf-8"),
	(error) => new IOError("Failed to save file", { cause: error }),
);
```

Additionally, you can use [`Result.wrap`](#resultwrapfn) to wrap a function and return a new function that returns a result. The main difference compared to `Result.try` is that `Result.wrap` returns a function, while `Result.try` executes the function immediately. 

```ts
const safeWriteFile = Result.wrap(fs.writeFileSync);

const result = safeWriteFile("file.txt", "Hello, World!", "utf-8"); // Result<void, Error>
```

### Performing operations on a result

Having a result is one thing, but in many cases, you also want to do something with it. This library provides a set of methods that lets you interact with the instance of a result in various ways.

#### Chaining operations

Similar to arrays and promises, you can also chain operations on a result. The main benefit of chaining operations is that you can keep your code compact, concise and readable, without having to assign intermediate results to variables. Let's look at an example:

```ts
// Without chaining
const resultA = someOperation();
if (resultA.isOk()) {
  const resultB = anotherOperation(resultA.value);
  if (resultB.isOk()) {
    const resultC = yetAnotherOperation(resultB.value);
    if (resultC.isOk()) {
      // do something
    } else {
      // handle error
    }
  } else {
    // handle error
  }
} else {
  // handle error
}

// With chaining
const result = someOperation()
  .map((value) => anotherOperation(value))
  .map((value) => yetAnotherOperation(value))

if (result.isOk()) {
  // do something
} else {
  // handle error
}
```

The chained version is more concise and makes it easier to follow the flow of the program. Moreover, it allows us to _centralize_ error handling at the end of the flow. This is possible because all transformative operations produce new results which carry over any errors that might have occurred earlier in the chain.

#### Transform: `map`, `mapCatching`, `recover`, `recoverCatching`, `mapError`

Both [`map`](#maptransformfn) and [`recover`](#recoveronfailure) behave very similar in the sense that they transform a result using function provided by the user into a new result. The main difference is that `map` is used to transform a successful result, while `recover` is used to transform a failed result.

The difference between the 'catching' variants is that they catch any exceptions that might be thrown inside the transformation function and encapsulate them in a failed result. So why would you not always use the 'catching' variants? It might be useful to make a distinction between exceptions that are expected and unexpected. If you _expect_ an exception to be thrown, like in the case of writing a file to disk, you might want to handle this use case. If you _don't expect_ an exception to be thrown, like in the case of saving something to a database, you might _not_ want to catch the exception and let the exception bubble up or even terminate the application.

There's a subtle difference with `mapCatching` however. It takes an optional second argument which is a function that lets you transform any caught exception that was thrown inside the transformation function. This is useful when you want to provide more context or when you want to wrap the error in a custom error type.

```ts
readFile("source.txt")
  .mapCatching(
    (contents) => writeFile("destination.txt", contents.toUpperCase()),
    (error) => new IOError("Failed to write file", { cause: error })
  )
```

Both `map` and `recover` are very flexible when it comes to the returning value of the transformation function. You can return a literal value, a new result, or even a promise that resolves to a value or a result. Other similar result-like libraries might have specific methods for each of thee use cases (e.g. `flatMap`, `chain`, etc.) and can be considered more strict. However, we like the approach of a smaller API surface with more flexibility.

All transformations below produce the same type of result (`Result<number, Error>`, with the exception of the async transformations which produce an `AsyncResult<number, Error>`):
```ts
someOperation() // Result<number, Error>
  .map((value) => value * 2) // Result<number, Error> 
  .map((value) => Result.ok(value * 2)) // Result<number, Error>
  .map((value) => Promise.resolve(value * 2)) // AsyncResult<number, Error>;
  .map(async (value) => value * 2) // AsyncResult<number, Error>;
  .map(async (value) => Result.ok(value * 2)) // AsyncResult<number, Error>;
```

`recover` is especially useful when you want to fall back to another scenario when a previous operation fails. In the example below, we try to persist an item in the database. If that fails, we fall back to persisting the item locally.

```ts
function persistInDB(item: Item): Result<Item, DbError> {
  // implementation
};
function persistLocally(item: Item): Result<Item, IOError> {
  // implementation
};

persistInDB(item).recover(() => persistLocally(item)); // Result<Item, IOError>
```

Note that after a recovery, any previous errors that might have occurred are _forgotten_. This is because when using `recover` you are essentially starting with a clean slate. In the example above we can assume that the `DbError` has been taken care of and therefore it has been removed from the final result. `IOError` on te other hand is still a possibility because it might occur after the recovery.

Lastly, you can use `mapError` to transform the error of a failed result. This is especially useful when you want to transform the error into a different error type, or when you want to provide more context to the error:

```ts
Result.try(() => fs.readFileSync("source.txt", "utf-8"))
  .mapCatching(contents => fs.writeFileSync("destination.txt", contents.toUpperCase(), "utf-8"))
  .mapError((error) => new IOError("Failed to transform file", { cause: error }));
  // Result<void, IOError>
```

#### Side-effects: `onSuccess`, `onFailure`

Sometimes you want to perform side-effects without modifying the result itself. This is where `onSuccess` and `onFailure` come in handy. Both methods allow you to run a callback function when the result is successful or when the result represents a failure. The main difference is that `onSuccess` is used for successful results, while `onFailure` is used for failed results. Both methods return the original instance of the result, so you can continue chaining other operations.

In the example below, we log a message when an operation is successful and when it fails:

```ts
someOperation()
  .onSuccess((value) => console.log("Operation succeeded with value", value))
  .onFailure((error) => console.error("Operation failed with error", error));
```

### Unwrapping a result

At some point in the flow of your program, you want to retrieve the value of a successful result or 
the error of a failed result. There are a couple of ways to do this, depending on your use case.

#### Using `toTuple()` to destructure the result

`toTuple()` returns the result in a tuple format where the first element is the _value_ and the second element is the _error_. We can leverage TypeScript's narrowing capabilities to infer the correct type of the value or error by doing a simple conditional check:

```ts
declare const result: Result<number, IOError>;

const [value, error] = result.toTuple();

if (value) {
  // at this point the value must be a number
} else {
  // error must be an instance of IOError
}
```

Another approach is to return early when the result is a failure. This is a pattern common in the Go language:

```ts
const [value, error] = result.toTuple();

if (error) {
  return Result.error(error);
}

return Result.ok(value * 2);
```

Note that in this example `Result.map` would be a better fit, but it illustrates the point. A more realistic example could be the handling of a request in a web API:

```ts
function handleRoute(id: number) {
  const [value, error] = performOperation(id).toTuple();

  if (error) {
    switch (error.type) {
      case "not-found":
        return {
          status: 404,
          body: "Not found",
        };
      case "unauthorized":
        return {
          status: 401,
          body: "Unauthorized",
        };
      default:
        return {
          status: 500,
          body: "Internal server error",
        };
    }
  }

  return {
    status: 200,
    body: value,
  }
}
```

#### Narrowing down the type using `isOk()` and `isError()`

Another imperative approach is to use the `isOk()` and `isError()` methods to narrow down the type of the result:

```ts
if (result.isOk()) {
  // TS infers that result.value is defined
  console.log(result.value);
} else if (result.isError()) {
  // TS infers that result.error is defined
  console.error(result.error);
}
```

If you do not use the type guards, TypeScript will infer the value or error as `T | undefined`. However, there is one exception to this rule: if a result has a error-type of `never`, it is safe to assume that the result can only be successful. Similarly, if the value-type is `never`, it is safe to assume that the result can only be a failure.

```ts
const resultA = Result.ok(42); // Result<number, never>
resultA.value; // can only be a `number`, since the error-type is `never`

const resultB = Result.error(new Error("Something went wrong")); // Result<never, Error>
resultB.value; // can only by `undefined`, since the value-type is `never`
resultB.error; // can only be an `Error`, since the value-type is `never`
```

#### Folding a result using `fold`

The `fold` method is a more functional approach to unwrapping a result. It allows you to provide two callbacks: one for the successful case and one for the failure case. The `fold` method will execute the appropriate callback based on the outcome of the result. Using `fold` is especially useful when you want to return the a single 'thing' based on the outcome of the result, for example when you want to return a response object:

```ts
function handleRoute(id: number) {
  return performOperation(id).fold(
    (value) => ({
      status: 200,
      body: value,
    }),
    (error) => {
      switch (error.type) {
        case "not-found":
          return {
            status: 404,
            body: "Not found",
          };
        case "unauthorized":
          return {
            status: 401,
            body: "Unauthorized",
          };
        default:
          return {
            status: 500,
            body: "Internal server error",
          };
      }
    }
  );
}
```

#### using 'getter' functions

Please consult the [API Reference](#api-reference) for a full list of available methods:
- [`errorOrNull`](#errorornull-1)
- [`getOrNull`](#getornull-1)
- [`getOrDefault`](#getordefaultdefaultvalue-1)
- [`getOrElse`](#getorelseonfailure-1)

### Handling errors

See the note on [errors](#a-note-on-errors) for more context.

When using custom errors together with a `type` field to distinguish between different error types, you can use conditional checks like 'if-else' or `switch` statements to handle different error types.

In order to perform exhaustive checks you can rely on the [`noImplicitReturns`](https://www.typescriptlang.org/tsconfig/#noImplicitReturns) compiler option when you are inside the context of a function and you are conditionally returning a value based on the `type` of the error:

```ts
class ErrorA extends Error {
  readonly type = "error-a";
}

class ErrorB extends Error {
  readonly type = "error-b";
}

declare const result: Result<number, ErrorA | ErrorB>;

result.fold(
  (value) => /* do something */,
  (error) => { // TS-Error: Not all code paths return a value
    switch (error.type) {
      case "error-a":
        return /* something */;
    }
  }
)
```

Alternatively, you can manually perform exhaustive checks by checking for `never` using a `default` case in a `switch` statement, or the `else` branch in an `if-else` statement:

```ts
class ErrorA extends Error {
  readonly type = "error-a";
}

class ErrorB extends Error {
  readonly type = "error-b";
}

declare const result: Result<number, ErrorA | ErrorB>;

if (result.isError()) {
  const error = result.error;
  if (error.type === "error-a") {
    // handle error-a
  } else if (error.type === "error-b") {
    // handle error-b
  } else {
    error satisfies never;
  }
}
```

Because this pattern is so common, this library exposes a little utility function called `assertUnreachable`:

```ts
import { assertUnreachable } from "typescript-result";

if (result.isError()) {
  const error = result.error;
  if (error.type === "error-a") {
    // handle error-a
  } else if (error.type === "error-b") {
    // handle error-b
  } else {
    assertUnreachable(error)
  }
}
```

When not all code paths are considered, the `assertUnreachable` function will start to complain. At runtime it will also throw an error when the `default` case is reached.

### Async operations

See [Async support](#async-support) for more context.

Because it can be quite cumbersome to work with results that are wrapped in a promise, we provide an `AsyncResult` type that is essentially a regular promise that contains a `Result` type, along with most of the methods that are available on the regular `Result` type. This makes it easier to chain operations without having to assign the intermediate results to a variable or having to use `await` for each async operation.

There are of course plenty of scenarios where an async function (or method) returns a `Result` (`Promise<Result<*, *>>`). Although there nothing wrong with this per se, it can become a bit cumbersome to await each function call before you can perform any operations. You can use the `fromAsync` and `fromAsyncCatching` utility methods to make working with results in an async context more ergonomic and developer-friendly.

There are two approaches you can choose from: transform to an `AsyncResult` _directly at the source_, or let the _consuming code_ handle the conversion. Let's look at both approaches in more detail.

#### Transforming to an `AsyncResult` directly at the source

Before:
```ts
// Note the `async` keyword and that we return a `Promise` holding a `Result`
async function findUserById(id: string): Promise<Result<User, NotFoundError>> {
  const user = await db.query("SELECT * FROM users WHERE id = ?", [id]);

  if (!user) {
    return Result.error(new NotFoundError("User not found"));
  }

  return Result.ok(user);
}

async function getDisplayName(userId: string): Promise<string> {
  return (await findUserById(userId))
    .map((user) => user.name)
    .getOrElse(() => "Unknown User");
}
```

After:
```ts
// Note that we no longer use the `async` keyword and that we return an `AsyncResult`
// instead of a `Promise`
function findUserById(id: string): AsyncResult<User, NotFoundError> {
  return Result.fromAsync(async () => {
    const user = await db.query("SELECT * FROM users WHERE id = ?", [id]);

    if (!user) {
      return Result.error(new NotFoundError("User not found"));
    }
    return Result.ok(user);
  });
}

function getDisplayName(userId: string): Promise<string> {
  return findUserById(userId)
    .map((user) => user.name)
    .getOrElse(() => "Unknown User");
}
```

The difference might be subtle, but if your codebase has a lot of async operations it might be worth considering this approach.

#### Let the consuming code handle the conversion

You can also choose to do the conversion from the consuming code. The previous example with this approach would translate to this:

```ts
async function findUserById(id: string): Promise<Result<User, NotFoundError>> {
  const user = await db.query("SELECT * FROM users WHERE id = ?", [id]);

  if (!user) {
    return Result.error(new NotFoundError("User not found"));
  }

  return Result.ok(user);
}

async function getDisplayName(userId: string): Promise<string> {
  return Result.fromAsync(findUserById(userId))
    .map((user) => user.name)
    .getOrElse(() => "Unknown User");
}
```

### Merging or combining results

In some cases you might want to combine multiple results into a single result. This can be done using the [`Result.all`](#resultallitems) and [`Result.allCatching`](#resultallcatchingitems) methods. The `Result.all` method will return a successful result if all results are successful, otherwise it will return the first error that occurred. This is especially useful when you want to run multiple independent operations and bundle the outcome into a single result:

```ts
declare function createTask(name: string): Result<Task, IOError>;

const tasks = ["task-a", "task-b", "task-c"];
const result = Result.all(...tasks.map(createTask)); // Result<Task[], IOError>
```

# API Reference

## Table of contents

- [Result](#result)
  - Properties
    - [isResult](#isresult)
    - [value](#value)
    - [error](#error)
  - Instance methods
    - [isOk()](#isok)
    - [isError()](#iserror)
    - [toTuple()](#totuple)
    - [errorOrNull()](#errorornull)
    - [getOrNull()](#getornull)
    - [getOrDefault(defaultValue)](#getordefaultdefaultvalue)
    - [getOrElse(onFailure)](#getorelseonfailure)
    - [getOrThrow()](#getorthrow)
    - [fold(onSuccess, onFailure)](#foldonsuccess-onfailure)
    - [onFailure(action)](#onfailureaction)
    - [onSuccess(action)](#onsuccessaction)
    - [map(transformFn)](#maptransformfn)
    - [mapCatching(transformFn, transformErrorFn?)](#mapcatchingtransformfn-transformerrorfn)
    - [mapError(transformFn)](#maperrortransformfn)
    - [recover(onFailure)](#recoveronfailure)
    - [recoverCatching(onFailure, transformErrorFn?)](#recovercatchingonfailure-transformerrorfn)
  - Static methods
    - [Result.ok(value)](#resultokvalue)
    - [Result.error(error)](#resulterrorerror)
    - [Result.isResult(possibleResult)](#resultisresultpossibleresult)
    - [Result.isAsyncResult(possibleAsyncResult)](#resultisasyncresultpossibleasyncresult)
    - [Result.all(items)](#resultallitems)
    - [Result.allCatching(items)](#resultallcatchingitems)
    - [Result.wrap(fn)](#resultwrapfn)
    - [Result.try(fn, [transform])](#resulttryfn-transform)
    - [Result.fromAsync()](#resultfromasync)
    - [Result.fromAsyncCatching()](#resultfromasynccatching)
    - [Result.assertOk(result)](#resultassertokresult)
    - [Result.assertError(result)](#resultasserterrorresult)
- [AsyncResult](#asyncresult)
  - Properties
    - [isAsyncResult](#isasyncresult)
  - Instance methods
    - [toTuple()](#totuple-1)
    - [errorOrNull()](#errorornull-1)
    - [getOrNull()](#getornull-1)
    - [getOrDefault(defaultValue)](#getordefaultdefaultvalue-1)
    - [getOrElse(onFailure)](#getorelseonfailure-1)
    - [getOrThrow()](#getorthrow-1)
    - [fold(onSuccess, onFailure)](#foldonsuccess-onfailure-1)
    - [onFailure(action)](#onfailureaction-1)
    - [onSuccess(action)](#onsuccessaction-1)
    - [map(transformFn)](#maptransformfn-1)
    - [mapCatching(transformFn, transfornErrorFn?)](#mapcatchingtransformfn-transformerrorfn-1)
    - [mapError(transformFn)](#maperrortransformfn-1)
    - [recover(onFailure)](#recoveronfailure-1)
    - [recoverCatching(onFailure, transformErrorFn?)](#recovercatchingonfailure-transformerrorfn-1)

## Result

Represents the outcome of an operation that can either succeed or fail.

```ts
class Result<Value, Error> {}
```

### isResult

Utility getter that checks if the current instance is a `Result`.

### value

Retrieves the encapsulated value of the result when the result is successful.

> [!NOTE]
> You can use [`Result.isOk()`](#isok) to narrow down the type to a successful result.

#### Example
obtaining the value of a result, without checking if it's successful
```ts
declare const result: Result<number, Error>;

result.value; // number | undefined
```

#### Example
obtaining the value of a result, after checking for success
```ts
declare const result: Result<number, Error>;

if (result.isOk()) {
  result.value; // number
}
```

### error

Retrieves the encapsulated error of the result when the result represents a failure.

> [!NOTE]
> You can use [`Result.isError()`](#iserror) to narrow down the type to a failed result.

#### Example
obtaining the value of a result, without checking if it's a failure

```ts
declare const result: Result<number, Error>;

result.error; // Error | undefined
```

#### Example
obtaining the error of a result, after checking for failure
```ts
declare const result: Result<number, Error>;

if (result.isError()) {
  result.error; // Error
}
```

### isOk()

Type guard that checks whether the result is successful.

**returns** `true` if the result is successful, otherwise `false`.

#### Example
checking if a result is successful
```ts
declare const result: Result<number, Error>;

if (result.isOk()) {
  result.value; // number
}
```

### isError()

Type guard that checks whether the result is successful.

**returns** `true` if the result represents a failure, otherwise `false`.

#### Example
checking if a result represents a failure
```ts
declare const result: Result<number, Error>;

if (result.isError()) {
  result.error; // Error
}
```

### toTuple()

**returns** the result in a tuple format where the first element is the value and the second element is the error.

If the result is successful, the error will be `null`. If the result is a failure, the value will be `null`.
This method is especially useful when you want to destructure the result into a tuple and use TypeScript's narrowing capabilities.

#### Example
Narrowing down the type using destructuring
```ts
declare const result: Result<number, ErrorA>;

const [value, error] = result.toTuple();

if (error) {
  // error is ErrorA
} else {
  // at this point the value must be a number
}
```

### errorOrNull()

**returns** the encapsulated error if the result is a failure, otherwise `null`.

### getOrNull()

**returns** the encapsulated value if the result is successful, otherwise `null`.

### getOrDefault(defaultValue)

Retrieves the value of the result, or a default value if the result is a failure.

#### Parameters

- `defaultValue` The value to return if the result is a failure.

**returns** The encapsulated value if the result is successful, otherwise the default value.

#### Example
obtaining the value of a result, or a default value
```ts
declare const result: Result<number, Error>;

const value = result.getOrDefault(0); // number
```

#### Example
using a different type for the default value
```ts
declare const result: Result<number, Error>;

const value = result.getOrDefault("default"); // number | string
```

### getOrElse(onFailure)

Retrieves the value of the result, or transforms the error using the `onFailure` callback into a value.

#### Parameters

- `onFailure` callback function which allows you to transform the error into a value. The callback can be async as well.

**returns** either the value if the result is successful, or the transformed error.

#### Example
transforming the error into a value
```ts
declare const result: Result<number, Error>;

const value = result.getOrElse((error) => 0); // number
```

#### Example
using an async callback
```ts
const value = await result.getOrElse(async (error) => 0); // Promise<number>
```

### getOrThrow()

Retrieves the value of the result, or throws an error if the result is a failure.

**returns** The value if the result is successful.

**throws** the encapsulated error if the result is a failure.

#### Example
obtaining the value of a result, or throwing an error
```ts
declare const result: Result<number, Error>;

const value = result.getOrThrow(); // number
```

### fold(onSuccess, onFailure)

Returns the result of the `onSuccess` callback when the result represents success or
the result of the `onFailure` callback when the result represents a failure.

> [!NOTE]
> Any exceptions that might be thrown inside the callbacks are not caught, so it is your responsibility
> to handle these exceptions

#### Parameters

- `onSuccess` callback function to run when the result is successful. The callback can be async as well.
- `onFailure` callback function to run when the result is a failure. The callback can be async as well.

**returns** * the result of the callback that was executed.

#### Example
folding a result to a response-like object

```ts
declare const result: Result<User, NotFoundError | UserDeactivatedError>;

const response = result.fold(
  (user) => ({ status: 200, body: user }),
  (error) => {
    switch (error.type) {
      case "not-found":
        return { status: 404, body: "User not found" };
      case "user-deactivated":
        return { status: 403, body: "User is deactivated" };
    }
  }
);
```

### onFailure(action)

Calls the `action` callback when the result represents a failure. It is meant to be used for
side-effects and the operation does not modify the result itself.

#### Parameters

- `action` callback function to run when the result is a failure. The callback can be async as well.

**returns** the original instance of the result.

> [!NOTE]
> Any exceptions that might be thrown inside the `action` callback are not caught, so it is your responsibility
> to handle these exceptions

#### Example
adding logging between operations
```ts
declare const result: Result<number, Error>;

result
  .onFailure((error) => console.error("I'm failing!", error))
  .map((value) => value 2); // proceed with other operations
```

### onSuccess(action)

Calls the `action` callback when the result represents a success. It is meant to be used for
side-effects and the operation does not modify the result itself.

#### Parameters

- `action` callback function to run when the result is successful. The callback can be async as well.

**returns** * the original instance of the result. If the callback is async, it returns a new [`AsyncResult`](#asyncresult) instance.

> [!NOTE]
> Any exceptions that might be thrown inside the `action` callback are not caught, so it is your responsibility
> to handle these exceptions

#### Example
adding logging between operations
```ts
declare const result: Result<number, Error>;

result
  .onSuccess((value) => console.log("I'm a success!", value))
  .map((value) => value 2); // proceed with other operations
```

#### Example
using an async callback
```ts
declare const result: Result<number, Error>;

const asyncResult = await result.onSuccess(async (value) => someAsyncOperation(value));
```

### map(transformFn)

Transforms the value of a successful result using the `transform` callback.
The `transform` callback can also be a generator function or a function that return other `Result` or [`AsyncResult`](#asyncresult) instances,
which will be returned as-is (the `Error` types will be merged, conceptually similar to `Array.flatMap()`).
The operation will be ignored if the result represents a failure.

#### Parameters

- `transformFn` callback function to transform the value of the result. The callback can be async or a generator function as well.

**returns** * a new [`Result`](#result) instance with the transformed value, or a new [`AsyncResult`](#asyncresult) instance
if the `transformFn` function is async.

> [!NOTE]
> Any exceptions that might be thrown inside the `transformFn` callback are not caught, so it is your responsibility
> to handle these exceptions. Please refer to [`Result.mapCatching()`](#mapcatchingtransformfn-transformerrorfn) for a version that catches exceptions
> and encapsulates them in a failed result.

#### Example
transforming the value of a result
```ts
declare const result: Result<number, Error>;

const transformed = result.map((value) => value 2); // Result<number, Error>
```

#### Example
returning a result instance
```ts
declare const result: Result<number, Error>;
declare function multiplyByTwo(value: number): Result<number, Error>;

const transformed = result.map((value) => multiplyByTwo(value)); // Result<number, Error>
```

#### Example
doing an async transformation
```ts
declare const result: Result<number, Error>;

const transformed = result.map(async (value) => value 2); // AsyncResult<number, Error>
```

#### Example
returning an async result instance

```ts
declare const result: Result<number, Error>;
declare function storeValue(value: number): AsyncResult<boolean, Error>;

const transformed = result.map((value) => storeValue(value)); // AsyncResult<boolean, Error>
```

#### Example
using a generator function to transform the value

```ts
function* doubleValue(value: number) {
  return value * 2;
}

declare const result: Result<number, Error>;
const transformed = result.map(doubleValue); // Result<number, Error>
```

### mapCatching(transformFn, transformErrorFn?)

Like [`Result.map`](#maptransformfn) it transforms the value of a successful result using the `transform` callback.
In addition, it catches any exceptions that might be thrown inside the `transform` callback and encapsulates them
in a failed result.

#### Parameters

- `transformFn` callback function to transform the value of the result. The callback can be async or a generator function as well.
- `transformErrorFn` optional callback function that transforms any caught error inside `transformFn` into a specific error.

**returns** * a new [`Result`](#result) instance with the transformed value, or a new [`AsyncResult`](#asyncresult) instance if the transform function is async.

### mapError(transformFn)

Transforms the error of a failed result using the `transform` callback into a new error.
This can be useful when you want to transform the error into a different error type, or when you want to provide more context to the error.

#### Parameters

- `transformFn` callback function to transform the error of the result.

**returns** a new failed [`Result`](#result) instance with the transformed error.

#### Example

transforming the error into a different error type

```ts
declare const result: Result<number, Error>;

result.mapError((error) => new ErrorB(error.message)); // Result<number, ErrorB>
```

### recover(onFailure)

Transforms a failed result using the `onFailure` callback into a successful result. Useful for falling back to
other scenarios when a previous operation fails.
The `onFailure` callback can also be a generator function or a function that returns other `Result` or [`AsyncResult`](#asyncresult) instances,
which will be returned as-is.
After a recovery, logically, the result can only be a success. Therefore, the error type is set to `never`, unless
the `onFailure` callback returns a result-instance with another error type.

#### Parameters

- `onFailure` callback function to transform the error of the result. The callback can be async or a generator function as well.

**returns** a new successful [`Result`](#result) instance or a new successful [`AsyncResult`](#asyncresult) instance
when the result represents a failure, or the original instance if it represents a success.

> [!NOTE]
> Any exceptions that might be thrown inside the `onFailure` callback are not caught, so it is your responsibility
> to handle these exceptions. Please refer to [`Result.recoverCatching`](#recovercatchingonfailure) for a version that catches exceptions
> and encapsulates them in a failed result.

#### Example
transforming the error into a value
Note: Since we recover after trying to persist in the database, we can assume that the `DbError` has been taken care
of and therefore it has been removed from the final result.
```ts
declare function persistInDB(item: Item): Result<Item, DbError>;
declare function persistLocally(item: Item): Result<Item, IOError>;

persistInDB(item).recover(() => persistLocally(item)); // Result<Item, IOError>
```

### recoverCatching(onFailure, transformErrorFn?)

Like [`Result.recover`](#recoveronfailure) it transforms a failed result using the `onFailure` callback into a successful result.
In addition, it catches any exceptions that might be thrown inside the `onFailure` callback and encapsulates them
in a failed result.

#### Parameters

- `onFailure` callback function to transform the error of the result. The callback can be async or a generator function as well.
- `transformError` callback function to transform any potential caught error while recovering the result.`

**returns** a new successful [`Result`](#result) instance or a new successful [`AsyncResult`](#asyncresult) instance when the result represents a failure, or the original instance if it represents a success.

### Result.ok(value)

Creates a new result instance that represents a successful outcome.

#### Parameters

- `value` The value to encapsulate in the result.

**returns** a new [`Result`](#result) instance.

#### Example
```ts
const result = Result.ok(42); // Result<number, never>
```

### Result.error(error)

Creates a new result instance that represents a failed outcome.

#### Parameters

- `error` The error to encapsulate in the result.

**returns** a new [`Result`](#result) instance.

#### Example
```ts
const result = Result.error(new NotFoundError()); // Result<never, NotFoundError>
```

### Result.isResult(possibleResult)

Type guard that checks whether the provided value is a [`Result`](#result) instance.

#### Parameters

- `possibleResult` any value that might be a [`Result`](#result) instance.

**returns* `true` if the provided value is a [`Result`](#result) instance, otherwise `false`.

### Result.isAsyncResult(possibleAsyncResult)

Type guard that checks whether the provided value is a [`AsyncResult`](#asyncresult) instance.

#### Parameters

- `possibleAsyncResult` any value that might be a [`AsyncResult`](#asyncresult) instance.

**returns** `true` if the provided value is a [`AsyncResult`](#asyncresult) instance, otherwise `false`.

### Result.all(items)

Similar to `Promise.all`, but for results.
Useful when you want to run multiple independent operations and bundle the outcome into a single result.
All possible values of the individual operations are collected into an array. `Result.all` will fail eagerly,
meaning that as soon as any of the operations fail, the entire result will be a failure.
Each argument can be a mixture of literal values, functions, [`Result`](#result) or [`AsyncResult`](#asyncresult) instances, or `Promise`.

#### Parameters

- `items` one or multiple literal value, function, [`Result`](#result) or [`AsyncResult`](#asyncresult) instance, `Promise`, or (async) generator function.

**returns** combined result of all the operations.

> [!NOTE]
> Any exceptions that might be thrown are not caught, so it is your responsibility
> to handle these exceptions. Please refer to [`Result.allCatching`](#resultallcatchingitems) for a version that catches exceptions
> and encapsulates them in a failed result.

#### Example
basic usage
```ts
declare function createTask(name: string): Result<Task, IOError>;

const tasks = ["task-a", "task-b", "task-c"];
const result = Result.all(...tasks.map(createTask)); // Result<Task[], IOError>
```

#### Example
running multiple operations and combining the results
```ts
const result = Result.all(
  "a",
  Promise.resolve("b"),
  Result.ok("c"),
  Result.try(async () => "d"),
  () => "e",
  () => Result.try(async () => "f"),
  () => Result.ok("g"),
  async () => "h",
  function *() { return "i"; }
); // AsyncResult<[string, string, string, string, string, string, string, string, string], Error>
```

### Result.allCatching(items)

Similar to [`Result.all`](#resultallitems), but catches any exceptions that might be thrown during the operations.

#### Parameters

- `items` one or multiple literal value, function, [`Result`](#result) or [`AsyncResult`](#asyncresult) instance, or `Promise`.

**returns** combined result of all the operations.

### Result.wrap(fn)

Wraps a function and returns a new function that returns a result. Especially useful when you want to work with
external functions that might throw exceptions.
The returned function will catch any exceptions that might be thrown and encapsulate them in a failed result.

#### Parameters

- `fn` function to wrap. Can be synchronous or asynchronous.

**returns** a new function that returns a result.

#### Example
basic usage
```ts
declare function divide(a: number, b: number): number;

const safeDivide = Result.wrap(divide);
const result = safeDivide(10, 0); // Result<number, Error>
```

### Result.try(fn, [transform])

Executes the given `fn` function and encapsulates the returned value as a successful result, or the
thrown exception as a failed result. In a way, you can view this method as a try-catch block that returns a result.

#### Parameters

- `fn` function with code to execute. Can be synchronous or asynchronous.
- `transform` optional callback to transform the caught error into a more meaningful error.

**returns** a new [`Result`](#result) instance.

#### Example
basic usage
```ts
declare function saveFileToDisk(filename: string): void; // might throw an error

const result = Result.try(() => saveFileToDisk("file.txt")); // Result<void, Error>
```

#### Example
basic usage with error transformation
```ts
declare function saveFileToDisk(filename: string): void; // might throw an error

const result = Result.try(
  () => saveFileToDisk("file.txt"),
  (error) => new IOError("Failed to save file", { cause: error })
); // Result<void, IOError>
```

### Result.fromAsync()

Utility method to:
- transform a Promise, that holds a literal value or
a [`Result`](#result) or [`AsyncResult`](#asyncresult) instance; or,
- transform an async function
into an [`AsyncResult`](#asyncresult) instance. Useful when you want to immediately chain operations
after calling an async function.

#### Parameters

- `promise` a Promise that holds a literal value or a [`Result`](#result) or [`AsyncResult`](#asyncresult) instance. or,
- `fn` an async callback funtion returning a literal value or a [`Result`](#result) or [`AsyncResult`](#asyncresult) instance.

**returns** a new [`AsyncResult`](#asyncresult) instance.

> [!NOTE]
> Any exceptions that might be thrown are not caught, so it is your responsibility
> to handle these exceptions. Please refer to [`Result.fromAsyncCatching`](#resultfromasynccatchingpromise) for a version that catches exceptions
> and encapsulates them in a failed result.

#### Example
basic usage

```ts
declare function someAsyncOperation(): Promise<Result<number, Error>>;

// without 'Result.fromAsync'
const result = (await someAsyncOperation()).map((value) => value 2); // Result<number, Error>

// with 'Result.fromAsync'
const asyncResult = Result.fromAsync(someAsyncOperation()).map((value) => value 2); // AsyncResult<number, Error>
```

### Result.fromAsyncCatching()

Similar to [`Result.fromAsync`](#resultfromasync) this method transforms a Promise or async callback function into an [`AsyncResult`](#asyncresult) instance.
In addition, it catches any exceptions that might be thrown during the operation and encapsulates them in a failed result.

### Result.gen()

Executes the given `fn` (async) generator function and encapsulates the returned value or error as a Result.
This method is often used once as entry point to run a specific flow. The reason for this is that nested generator functions or calls to other functions that return results are supported.

#### Parameters
- `fn` (async) generator function to execute.

**returns** a new [`AsyncResult`](#asyncresult) or `Result` instance depending on the provided callback fn.

#### Example

```ts
const result = Result.gen(async function* () {
   const order = yield* getOrderById("123"); // AsyncResult<Order, NotFoundError>
   yield* order.ship(); // Result<void, InvalidOrderStatusError>;
   const arrivalDate = await shipmentService.calculateArrivalDate(order);
   return `Your order has been shipped and is expected to arrive on ${arrivalDate}!`;
}); // AsyncResult<string, NotFoundError | InvalidOrderStatusError>;
```

### Result.genCatching()

Similar to [`Result.gen()`](#resultgen) this method transforms the given generator function into a `Result` or [`AsyncResult`](#asyncresult) depending on whether the generator function contains async operations or not.
In addition, it catches any exceptions that might be thrown during any operation and encapsulates them in a failed result.

#### Parameters
- `fn` (async) generator function to execute.

**returns** a new [`AsyncResult`](#asyncresult) or `Result` instance depending on the provided callback fn.

### Result.assertOk(result)

Asserts that the provided result is successful. If the result is a failure, an error is thrown.
Useful in unit tests.

#### Parameters

- `result` the result instance to assert against.

### Result.assertError(result)

Asserts that the provided result is a failure. If the result is successful, an error is thrown.
Useful in unit tests.

#### Parameters

- `result` the result instance to assert against.

## AsyncResult

Represents the asynchronous outcome of an operation that can either succeed or fail.

```ts
class AsyncResult<Value, Error> {}
```

### isAsyncResult

Utility getter that checks if the current instance is an `AsyncResult`.

### toTuple()

**returns** the result in a tuple format where the first element is the value and the second element is the error.

If the result is successful, the error will be `null`. If the result is a failure, the value will be `null`.
This method is especially useful when you want to destructure the result into a tuple and use TypeScript's narrowing capabilities.

#### Example
Narrowing down the type using destructuring
```ts
declare const result: AsyncResult<number, ErrorA>;

const [value, error] = result.toTuple();

if (error) {
  // error is ErrorA
} else {
  // at this point the value must be a number
}
```

### errorOrNull()

**returns** the encapsulated error if the result is a failure, otherwise `null`.

### getOrNull()

**returns** the encapsulated value if the result is successful, otherwise `null`.

### getOrDefault(defaultValue)

Retrieves the encapsulated value of the result, or a default value if the result is a failure.

#### Parameters

- `defaultValue` The value to return if the result is a failure.

**returns** The encapsulated value if the result is successful, otherwise the default value.

#### Example
obtaining the value of a result, or a default value
```ts
declare const result: AsyncResult<number, Error>;

const value = await result.getOrDefault(0); // number
```

#### Example
using a different type for the default value
```ts
declare const result: AsyncResult<number, Error>;

const value = await result.getOrDefault("default"); // number | string
```

### getOrElse(onFailure)

Retrieves the value of the result, or transforms the error using the `onFailure` callback into a value.

#### Parameters

- `onFailure` callback function which allows you to transform the error into a value. The callback can be async as well.

**returns** either the value if the result is successful, or the transformed error.

#### Example
transforming the error into a value
```ts
declare const result: AsyncResult<number, Error>;

const value = await result.getOrElse((error) => 0); // number
```

#### Example
using an async callback
```ts
const value = await result.getOrElse(async (error) => 0); // number
```

### getOrThrow()

Retrieves the encapsulated value of the result, or throws an error if the result is a failure.

**returns** The encapsulated value if the result is successful.

**throws** the encapsulated error if the result is a failure.

#### Example
obtaining the value of a result, or throwing an error
```ts
declare const result: AsyncResult<number, Error>;

const value = await result.getOrThrow(); // number
```

### fold(onSuccess, onFailure)

Returns the result of the `onSuccess` callback when the result represents success or
the result of the `onFailure` callback when the result represents a failure.

> [!NOTE]
> Any exceptions that might be thrown inside the callbacks are not caught, so it is your responsibility
> to handle these exceptions

#### Parameters

- `onSuccess` callback function to run when the result is successful. The callback can be async as well.

- `onFailure` callback function to run when the result is a failure. The callback can be async as well.

**returns** the result of the callback that was executed.

#### Example
folding a result to a response-like object

```ts
declare const result: AsyncResult<User, NotFoundError | UserDeactivatedError>;

const response = await result.fold(
  (user) => ({ status: 200, body: user }),
  (error) => {
    switch (error.type) {
      case "not-found":
        return { status: 404, body: "User not found" };
      case "user-deactivated":
        return { status: 403, body: "User is deactivated" };
    }
  }
);
```

### onFailure(action)

Calls the `action` callback when the result represents a failure. It is meant to be used for
side-effects and the operation does not modify the result itself.

#### Parameters

- `action` callback function to run when the result is a failure. The callback can be async as well.

**returns** the original instance of the result.

> [!NOTE]
> Any exceptions that might be thrown inside the `action` callback are not caught, so it is your responsibility
> to handle these exceptions

#### Example
adding logging between operations
```ts
declare const result: AsyncResult<number, Error>;

result
  .onFailure((error) => console.error("I'm failing!", error))
  .map((value) => value 2); // proceed with other operations
```

### onSuccess(action)

Calls the `action` callback when the result represents a success. It is meant to be used for
side-effects and the operation does not modify the result itself.

#### Parameters

- `action` callback function to run when the result is successful. The callback can be async as well.

**returns** the original instance of the result.

> [!NOTE]
> Any exceptions that might be thrown inside the `action` callback are not caught, so it is your responsibility
> to handle these exceptions

#### Example
adding logging between operations
```ts
declare const result: AsyncResult<number, Error>;

result
  .onSuccess((value) => console.log("I'm a success!", value))
  .map((value) => value 2); // proceed with other operations
```

#### Example
using an async callback
```ts
declare const result: AsyncResultResult<number, Error>;

const asyncResult = await result.onSuccess(async (value) => someAsyncOperation(value));
```

### map(transformFn)

Transforms the value of a successful result using the `transform` callback.
The `transform` callback can also be a generator function or a function that return other `Result` or [`AsyncResult`](#asyncresult) instances,
which will be returned as-is (the `Error` types will be merged, conceptually similar to `Array.flatMap()`).
The operation will be ignored if the result represents a failure.

#### Parameters

- `transformFn` callback function to transform the value of the result. The callback can be async or a generator function as well.

**returns** a new [`AsyncResult`](#asyncresult) instance with the transformed value

> [!NOTE]
> Any exceptions that might be thrown inside the `transform` callback are not caught, so it is your responsibility
> to handle these exceptions. Please refer to [`AsyncResult.mapCatching`](#mapcatchingtransformfn-transformerrorfn-1) for a version that catches exceptions
> and encapsulates them in a failed result.

#### Example
transforming the value of a result
```ts
declare const result: AsyncResult<number, Error>;

const transformed = result.map((value) => value 2); // AsyncResult<number, Error>
```

#### Example
returning a result instance
```ts
declare const result: AsyncResult<number, Error>;
declare function multiplyByTwo(value: number): Result<number, Error>;

const transformed = result.map((value) => multiplyByTwo(value)); // AsyncResult<number, Error>
```

#### Example
doing an async transformation
```ts
declare const result: AsyncResult<number, Error>;

const transformed = result.map(async (value) => value 2); // AsyncResult<number, Error>
```

#### Example
returning an async result instance

```ts
declare const result: AsyncResult<number, Error>;
declare function storeValue(value: number): AsyncResult<boolean, Error>;

const transformed = result.map((value) => storeValue(value)); // AsyncResult<boolean, Error>
```

#### Example
using a generator function to transform the value

```ts
function* doubleValue(value: number) {
  return value * 2;
}

declare const result: Async<number, Error>;
const transformed = result.map(doubleValue); // Async<number, Error>
```

### mapCatching(transformFn, transformErrorFn?)

Like [`AsyncResult.map`](#maptransformfn-1) it transforms the value of a successful result using the `transformFn` callback.
In addition, it catches any exceptions that might be thrown inside the `transformFn` callback and encapsulates them
in a failed result.

#### Parameters

- `transformFn` callback function to transform the value of the result. The callback can be async or a generator function as well.
- `transformErrorFn` optional callback function that transforms any caught error inside `transformFn` into a specific error.

**returns** a new [`AsyncResult`](#asyncresult) instance with the transformed value

### mapError(transformFn)

Transforms the error of a failed result using the `transform` callback into a new error.
This can be useful when you want to transform the error into a different error type, or when you want to provide more context to the error.

#### Parameters

- `transformFn` callback function to transform the error of the result.

**returns** a new failed [`AsyncResult`](#asyncresult) instance with the transformed error.

#### Example

transforming the error into a different error type

```ts
const result = Result.try(() => fetch("https://example.com"))
  .mapCatching((response) => response.json() as Promise<Data>)
  .mapError((error) => new FetchDataError("Failed to fetch data", { cause: error }));
  // AsyncResult<Data, FetchDataError>;
```


### recover(onFailure)

Transforms a failed result using the `onFailure` callback into a successful result. Useful for falling back to
other scenarios when a previous operation fails.
The `onFailure` callback can also be a generator function or a function that returns other `Result` or [`AsyncResult`](#asyncresult) instances, which will be returned as-is (much like `Array.flatMap`).
After a recovery, logically, the result can only be a success. Therefore, the error type is set to `never`, unless
the `onFailure` callback returns a result-instance with another error type.

#### Parameters

- `onFailure` callback function to transform the error of the result. The callback can be async or a generator function as well.

**returns** a new successful [`AsyncResult`](#asyncresult) instance when the result represents a failure, or the original instance
if it represents a success.

> [!NOTE]
> Any exceptions that might be thrown inside the `onFailure` callback are not caught, so it is your responsibility
> to handle these exceptions. Please refer to [`AsyncResult.recoverCatching`](#recovercatchingonfailure-1) for a version that catches exceptions
> and encapsulates them in a failed result.

#### Example
transforming the error into a value
Note: Since we recover after trying to persist in the database, we can assume that the `DbError` has been taken care
of and therefore it has been removed from the final result.
```ts
declare function persistInDB(item: Item): AsyncResult<Item, DbError>;
declare function persistLocally(item: Item): AsyncResult<Item, IOError>;

persistInDB(item).recover(() => persistLocally(item)); // AsyncResult<Item, IOError>
```

### recoverCatching(onFailure, transformErrorFn?)

Like [`AsyncResult.recover`](#recoveronfailure-1) it transforms a failed result using the `onFailure` callback into a successful result.
In addition, it catches any exceptions that might be thrown inside the `onFailure` callback and encapsulates them
in a failed result.

#### Parameters

- `onFailure` callback function to transform the error of the result. The callback can be async or a generator function as well.
- `transformError` callback function to transform any potential caught error while recovering the result.`

**returns** a new successful [`AsyncResult`](#asyncresult) instance when the result represents a failure, or the original instance
if it represents a success.