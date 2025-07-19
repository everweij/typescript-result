---
outline: deep
---

# Chaining vs. generator syntax

Having a result is one thing, but in many cases, you also want to do something useful with it. This library provides a set of methods and tools that lets you interact with the instance of a result in various ways.

There are two styles of working with results:
- the more **functional** approach, also known as the [_chaining style_](#chaining-operations)
- the more **imperative** approach, also known as the [_generator style_](#using-generators)

In a way, the chaining style is similar to how you would _chain_ promises using `.then()`, while the more imperative style is similar to how you would use `async`/`await`. Both styles are equally valid and can be used interchangeably. The choice is mostly a matter of personal preference, but we will try to explain the benefits of each style.

::: info
Generally speaking: if you find yourself writing a lot of nested chains (e.g. `map`'s) or you often use loops or conditional logic, you are probably better off using the _generator_ style. On the other hand, if you find yourself writing a lot of simple transformations that can be expressed in a single line, or you simple like the functional style, you are probably better off using the _chaining_ style.
:::

## Chaining operations

Similar to arrays and promises, you can also chain operations on a result. The main benefit of chaining operations is that you can keep your code compact, concise and readable, without having to assign intermediate results to variables. Let's look at an example:

```ts
// Without chaining
const resultA = someOperation();
if (resultA.ok) {
  const resultB = anotherOperation(resultA.value);
  if (resultB.ok) {
    const resultC = yetAnotherOperation(resultB.value);
    if (resultC.ok) {
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

if (result.ok) {
  // do something
} else {
  // handle error
}
```

Compared to the version without chaining, the chained version is more concise and makes it easier to follow the flow of the program. Moreover, it allows us to _centralize_ error handling at the end of the flow. This is possible because all transformative operations produce new results which carry over any errors that might have occurred earlier in the chain.

## Using generators

Generator functions might look unfamiliar at first, but they offer a powerful way to write error-handling code that feels natural and imperative while maintaining all the type safety benefits of Results. The key insight is that with generators, you can write code that looks like normal sequential operations while automatically collecting all possible errors in the background.

::: tip
**The golden rule**: Use `yield*` for every `Result` or `AsyncResult` operation. This gives you direct access to the success value without manual unwrapping.
:::

The generator approach shines when you have:
- **Complex control flow** with conditionals and loops
- **Nested transformations** that become hard to read with chaining

Let's look at an example by comparing the chaining style with the generator style:

::: code-group

```ts twoslash [Generator style]
import { Result, AsyncResult } from "typescript-result";

class UnableToFetchTransactionAmountError extends Error {
  readonly type = "unable-to-fetch-transaction-amount";
}

class UnableToFetchDiscountRateError extends Error {
  readonly type = "unable-to-fetch-discount-rate";
}

class InvalidDiscountRateError extends Error {
  readonly type = "invalid-discount-rate";
}

declare function fetchTransactionAmount(transactionId: string):
  AsyncResult<number, UnableToFetchTransactionAmountError>;

declare function fetchDiscountRate(transactionId: string):
  AsyncResult<number, UnableToFetchDiscountRateError>;

function applyDiscount(total: number, discountRate: number) {
  if (discountRate === 0) {
    return Result.error(new InvalidDiscountRateError("Discount rate cannot be zero"));
  }

  return Result.ok(total * (1 - discountRate));
}
// ---cut-before---
function* getDiscountedPrice(transactionId: string) {
  const amount = yield* fetchTransactionAmount(transactionId);

  const discountRate = yield* fetchDiscountRate(transactionId)
    .recover(() => 0.1); // Default discount rate if fetching fails

  const finalAmount = yield* applyDiscount(amount, discountRate);

  return `Final amount to charge: ${finalAmount}`;
}

const result = await Result.gen(getDiscountedPrice("transaction-123"));
//    ^?


// 
```

```ts twoslash [Chaining style]
import { Result, AsyncResult } from "typescript-result";

class UnableToFetchTransactionAmountError extends Error {
  readonly type = "unable-to-fetch-transaction-amount";
}

class UnableToFetchDiscountRateError extends Error {
  readonly type = "unable-to-fetch-discount-rate";
}

class InvalidDiscountRateError extends Error {
  readonly type = "invalid-discount-rate";
}

declare function fetchTransactionAmount(transactionId: string):
  AsyncResult<number, UnableToFetchTransactionAmountError>;

declare function fetchDiscountRate(transactionId: string):
  AsyncResult<number, UnableToFetchDiscountRateError>;

function applyDiscount(total: number, discountRate: number) {
  if (discountRate === 0) {
    return Result.error(new InvalidDiscountRateError("Discount rate cannot be zero"));
  }

  return Result.ok(total * (1 - discountRate));
}
// ---cut-before---
function getDiscountedPrice(transactionId: string) {
  return fetchTransactionAmount(transactionId)
    .map((amount) =>
      fetchDiscountRate(transactionId)
        .recover(() => 0.1) // Default discount rate if fetching fails
        .map((discountRate) => applyDiscount(amount, discountRate)),
    )
    .map((finalAmount) => `Final amount to charge: ${finalAmount}`);
}

const result = await getDiscountedPrice("transaction-123");
//    ^?


//
```

```ts [shared]
class UnableToFetchTransactionAmountError extends Error {
  readonly type = "unable-to-fetch-transaction-amount";
}

class UnableToFetchDiscountRateError extends Error {
  readonly type = "unable-to-fetch-discount-rate";
}

declare function fetchTransactionAmount(transactionId: string):
  AsyncResult<number, UnableToFetchTransactionAmountError>;

declare function fetchDiscountRate(transactionId: string):
  AsyncResult<number, UnableToFetchDiscountRateError>;

function applyDiscount(total: number, discountRate: number) {
  if (discountRate === 0) {
    return Result.error(new InvalidDiscountRateError("Discount rate cannot be zero"));
  }

  return Result.ok(total * (1 - discountRate));
}
```
:::

As you can see, the generator style reads more linear and is therefore arguably easier to follow.

### `Result.gen`

The `Result.gen` function is the main entry point for using generator functions with results. It takes either a generator function or a generator directly as an argument and returns a `Result` or `AsyncResult` depending on whether the generator function is synchronous or asynchronous.

### Async generators functions

If you want to perform asynchronous operations inside a generator function, you can use a `async function*` callback:

```ts {4}
const result = Result.gen(async function* () {
  const valueA = yield* someFn();

  const valueB = await someAsyncFn(valueA);

  return valueB;
}); // AsyncResult
```

### Mixing styles

You can combine generators with method chaining when it makes sense:

```ts
const result = Result.ok(12)
  .map(function* (value) {
    const doubled = yield* someOperation(value);
    const tripled = yield* anotherOperation(doubled); 
    return tripled;
  })
  .map(finalValue => `Result: ${finalValue}`);
```

### 'This' context

If you need access to the `this` context inside a generator function, you can use the overload of `Result.gen` or `Result.genCatching` by providing `this` is the first argument:

```ts
class OrderProcessor {
  private tax = 0.08;
  
  processOrder(orderId: string) {
    return Result.gen(this, function* () {
      const order = yield* this.fetchOrder(orderId);
      const subtotal = yield* this.calculateSubtotal(order);
      return subtotal * (1 + this.tax);
    });
  }
}
```

### Nesting generator functions

You can nest generator functions inside each other, but you need to use `yield*` to delegate the execution to the inner generator:

```ts
function* innerGenerator() {
  const value = yield* resultReturningFunc();
  return `Inner result: ${value}`;
}

function* outerGenerator() {
  const innerResult = yield* innerGenerator();
  return `Outer result: ${innerResult}`;
}

const result = Result.gen(outerGenerator());
```