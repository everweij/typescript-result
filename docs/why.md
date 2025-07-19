# Why TypeScript Result?

There are already a few quality libraries out there that provide a Result type or similar for TypeScript. We believe that there are a couple of reasons why you should consider using this library.

## Ergonomic error handling

The goal is to keep the effort in using this library as _light as possible_, with a relatively small API surface -- you only have to learn a few methods. We don't want to introduce a whole new programming model where you would have to learn a ton of new concepts. Instead, we want to build on top of the existing features and best practices of the language, and provide a simple and intuitive API that is easy to understand and use. It also should be easy to incrementally adopt within existing codebase.


```typescript twoslash
// @errors: 2349
import { Result } from "typescript-result";

class NotEnoughStockError extends Error {
  readonly type = "not-enough-stock";
}

class InsufficientBalanceError extends Error {
  readonly type = "insufficient-balance";
}

class Basket {
  getTotalPrice(): number {
    return 0; // skipped for brevity
  }

  getProducts(): Product[] {
    return []; // skipped for brevity
  }
}

class Stock {
  hasEnoughStock(products: Product[]): boolean {
    return true; // skipped for brevity
  }
}

declare function getCurrentStock(): Stock;
declare function getUserBasket(userId: number): Basket;
declare function getUserAccount(userId: number): Account;

class Account {
  balance: number = 0; // skipped for brevity
}

type Product = { id: number; price: number };
type Order = Record<string, any>;

// ---cut-before---
function processOrder(stock: Stock, basket: Basket, account: Account) {
  if (basket.getTotalPrice() > account.balance) {
    return Result.error(new InsufficientBalanceError());
  }

  if (!stock.hasEnoughStock(basket.getProducts())) {
    return Result.error(new NotEnoughStockError());
  }

  const order: Order = { /* skipped for brevity */ }

  return Result.ok(order);
}

function handleOrder(userId: number) {
  const result = processOrder(
    getCurrentStock(),
    getUserBasket(userId),
    getUserAccount(userId)
  );

  if (!result.ok) {
    return result
      .match()
      .when(InsufficientBalanceError, () => ({
        status: 400,
        body: "Insufficient balance",
      }))
      .run();
  }

  return {
    status: 200,
    body: `Order with id ${result.value.id} placed successfully`,
  }
}
```

In the example above, TypeScript will notify us that we did not handle all possible failures. Rightfully so, because we forgot to implement the case where there is not enough stock. This is a great example of how TypeScript can help us catch potential bugs early in the development process, and how using a Result type can make error handling more explicit and structured.

## Let type inference do the heavy lifting

TypeScript's type inference is powerful, and we want to leverage that to make your life easier. You can just return `Result.ok()` or `Result.error()` and let TypeScript do the heavy lifting. Compared to other libraries, this means you _don't_ have to write a lot of boilerplate code to handle the Result type, making your code cleaner and more maintainable.

## Seamless async support

Result instances that are wrapped in a Promise can be painful to work with, because you would have to `await` every async operation before you can _chain_ next operations (like 'map', 'fold', etc.). To solve this and to make your code more ergonomic we provide an `AsyncResult` that is essentially a regular Promise containing a `Result` type, along with a couple of methods to make it easier to chain operations without having to assign the intermediate results to a variable or having to use `await` for each async operation.

```typescript
const firstAsyncResult = await someAsyncFunction1(); // [!code --]
if (firstAsyncResult.ok) { // [!code --]
  const secondAsyncResult = await someAsyncFunction2(firstAsyncResult.value); // [!code --]
  if (secondAsyncResult.ok) { // [!code --]
    const thirdAsyncResult = await someAsyncFunction3(secondAsyncResult.value); // [!code --]
    if (thirdAsyncResult.ok) { // [!code --]
      // do something  // [!code --]
    } else {  // [!code --]
      // handle error  // [!code --]
    }  // [!code --]
  } else { // [!code --]
    // handle error // [!code --]
  } // [!code --]
} else { // [!code --]
  // handle error // [!code --]
} // [!code --]
const result = await someAsyncFunction1() // [!code ++]
  .map((value) => someAsyncFunction2(value)) // [!code ++]
  .map((value) => someAsyncFunction3(value)); // [!code ++]
```

You rarely have to deal with `AsyncResult` directly though, because this library will automatically convert the result of an async operation to an `AsyncResult` when needed, and since the API's are almost identical in shape, there's a big chance you wouldn't even notice you're using a `AsyncResult` under the hood. Let's look at an example what this means in practice:

```ts twoslash
import { Result } from "typescript-result";

class ValidationError extends Error {
  readonly type = "validation-error";
}
// ---cut-before---
// start with a sync result -> Result.Ok<number>
const result = await Result.ok(12)

  // map the value to a Promise -> AsyncResult<number, never>
  .map((value) => Promise.resolve(value * 2)) // 

  // map async to another result -> AsyncResult<string, ValidationError>
  .map(async (value) => {
    if (value < 10) {
      return Result.error(new ValidationError("Value is too low"));
    }

    return Result.ok("All good!");
  });
```

### Support for generators

Popularized by [EffectTS](https://effect.website/docs/getting-started/using-generators/), this library supports the use of generator functions to create and work with results. This allows you to write more imperative code that is easier to read and understand, while still benefiting from the type safety and error handling provided by the Result type. You don't have to use the generator syntax - it's fully optional. For more info, see [Chaining vs. generator syntax](/chaining-vs-generator-syntax#using-generators).