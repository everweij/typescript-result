<img alt="TypeScript Result logo" width="84px" src="./assets/typescript-result-logo.svg" />

# TypeScript Result

[![NPM](https://img.shields.io/npm/v/typescript-result.svg)](https://www.npmjs.com/package/typescript-result)
[![TYPESCRIPT](https://img.shields.io/badge/%3C%2F%3E-typescript-blue)](http://www.typescriptlang.org/)
[![BUNDLEPHOBIA](https://badgen.net/bundlephobia/minzip/typescript-result)](https://bundlephobia.com/result?p=typescript-result)
[![Weekly downloads](https://badgen.net/npm/dw/typescript-result)](https://badgen.net/npm/dw/typescript-result)

A Result type inspired by Rust and Kotlin that leverages TypeScript's powerful type system to simplify error handling and make your code more readable and maintainable.

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

```typescript
import { Result } from "typescript-result";

class DivisionByZeroError extends Error {
  readonly type = "division-by-zero";
}

function divide(a: number, b: number) {
  if (b === 0) {
    return Result.error(new DivisionByZeroError(`Cannot divide ${a} by zero`));
  }

  return Result.ok(a / b);
}

const result = divide(10, 2);
if (result.isOk()) {
  console.log(result.value); // 5
} else {
  console.error(result.error); // DivisionByZeroError
}
```

## Why use a result type?

### Errors as values

The Result type is a product of the ‘error-as-value’ movement which in turn has its roots in function programming. When throwing exceptions, all errors are treated equally, and behave different compared to the normal flow of the program. Instead, we like to make a distinction between expected errors and unexpected errors, and make the expected errors part of the normal flow of the program. By explicitely defining that a piece of code can either fail or succeed using the Result type, we can leverage TypeScript's powerful type system to keep track for us everything that can go wrong in our code, and let it correct us when we overlooked a certain scenarios by performing exhaustive checks. This makes our code more type-safe, easier to maintain, and more transparent.

### Ergonomic error handling

The goal is to keep the effort in using this library as light as possible, with a relatively small API surface. We don't want to introduce a whole new programming model where you would have to learn a ton of new concepts. Instead, we want to build on top of the existing features and best practices of the language, and provide a simple and intuitive API that is easy to understand and use. It also should be easy to incrementally adopt with existing codebases.

## Why use this library?

There are already a few quality libraries out there that provide a Result type or similar for TypeScript. We believe that there are two reasons why you should consider using this library.

### Async support

The make your code more ergonomic we provide an `AsyncResult` that is essentially a regular Promise that contains a `Result` type, along with a couple of methods, to make it easier to chain operations without having to assign the intermediate results to a variable or having to use `await` for each async operation.

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

## _Full_ type safety without a lot of boilerplate

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
    (error) => { // Error: Not all code paths return a value
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
