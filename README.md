<img alt="react-laag logo" src="./logo.jpg" />

[![NPM](https://img.shields.io/npm/v/typescript-result.svg)](https://www.npmjs.com/package/typescript-result)
[![TYPESCRIPT](https://img.shields.io/badge/%3C%2F%3E-typescript-blue)](http://www.typescriptlang.org/)
[![BUNDLEPHOBIA](https://badgen.net/bundlephobia/minzip/typescript-result)](https://bundlephobia.com/result?p=typescript-result)
[![Weekly downloads](https://badgen.net/npm/dw/typescript-result)](https://badgen.net/npm/dw/typescript-result)

Heavily inspired by the Rust and Kotlin counterparts, this utility helps you with code that might fail in a declarative way.

## Why?

Imagine we need a function that performs some kind of I/O task that might fail:

```ts
function readStuffFromFile(path: string): string {
  let stuff: string;

  if (!fileDoesExist(path)) {
    throw new Error(`The file ${path} does not exist`);
  }

  // ... implementation here ...

  return stuff;
}

function app() {
  try {
    const stuff = readStuffFromFile("/my/path/to/file.txt");
  } catch (err) {
    console.error("Unable to read stuff!");
  }
}
```

The problem with this 'usual' try-catch approach is that:

- it makes our code harder to reason about. We need to look at implementation details to discover what might go wrong.
- it makes the control flow of our code harder to reason about, especially with multiple (nested) try-catch statements

Instead, we could express the outcome of code to be executed in the form of a Result-type. People using your code will be explicitly confronted with the fact that code potentially might fail, and will know upfront what kind of errors they can expect.

## Installation

```bash
npm install --save typescript-result
```

or

```bash
yarn add typescript-result
```

## Usage

typescript-result exposes a single type:

```ts
import { Result } from "typescript-result";
```

Basically `Result` is a container with a generic type: one for failure, and one for success:

```ts
Result<ErrorType, OkType>
```

### Example

Let's refactor the `readStuffFromFile()` a bit:

```ts
import { Result } from "typescript-result";

class FileDoesNotExistError extends Error {}

function readStuffFromFile(
  path: string
): Result<FileDoesNotExistError | Error, string> {
  try {
    let stuff: string;

    if (!fileDoesExist(path)) {
      return Result.error(
        new FileDoesNotExistError(`The file ${path} does not exist`)
      );
    }

    // ... implementation here ...

    return Result.ok(stuff);
  } catch (e) {
    return Result.error(e);
  }
}

function app() {
  const result = readStuffFromFile("/my/path/to/file.txt");

  if (result.isSuccess()) {
    // we're on the 'happy' path!
  } else {
    switch (result.error.constructor) {
      case FileDoesNotExistError:
        // handle the error
        // i.e. inform the user
        break;
      default:
      // an unexpected error...
      // something might be seriously wrong
      // i.e. log this error somewhere
    }
  }
}
```

### Static creation methods

#### Result.ok and Result.error

```ts
function doStuff(value: number): Result<Error, number> {
  if (value === 2) {
    return Result.error(new Error("Number 2 is not allowed!"));
  }

  return Result.ok(value * 2);
}
```

#### Result.safe

Functions as a try-catch, returning the return-value of the callback on success, or the predefined error(-class) or caught error on failure:

```ts
// with caught error...
const result = Result.safe(() => {
  let value = 2;

  // code that might throw...

  return value;
}); // Result<Error, number>

// with predefined error...
class CustomError extends Error {}

const result = Result.safe(new CustomError("Custom error!"), () => {
  let value = 2;

  // code that might throw...

  return value;
}); // Result<CustomError, number>

// with predefined error-class...
class CustomError extends Error {}

const result = Result.safe(CustomError, () => {
  let value = 2;

  // code that might throw...

  return value;
}); // Result<CustomError, number>
```

#### Result.combine

Accepts multiple Results or functions that return Results and returns a singe Result. Successful values will be placed inside a tuple.

```ts
class CustomError extends Error {}

function doA(): Result<Error, string> {}
function doB(value: number): Result<Error, number> {}
function doC(value: string): Result<CustomError, Date> {}

const result = Result.combine(
  doA(),
  () => doB(2),
  () => doC("hello")
); // Result<Error | CustomError, [string, number, Date]>

if (result.isSuccess()) {
  result.value; // [string, number, Date]
}
```

#### Result.wrap

Transforms an existing function into a function that returns a Result:

```ts
function add2(value: number) {
  // code that might throw....

  return value + 2;
}

const wrappedAdd2 = Result.wrap(add2);

const result1 = add2(4); // number;
const result2 = wrappedAdd2(4); // Result<Error, number>;
```

### Instance methods of Result

#### Result.isSuccess()

Indicates whether the Result is of type Ok. By doing this check you gain access to the encapsulated `value`:

```ts
const result = doStuff();
if (result.isSuccess()) {
  result.value; // we now have access to 'value'
} else {
  result.error; // we now have access to 'error'
}
```

#### Result.isFailure()

Indicates whether the Result is of type Error. By doing this check you gain access to the encapsulated `error`:

```ts
const result = doStuff();
if (result.isFailure()) {
  result.error; // we now have access to 'error'
} else {
  result.value; // we now have access to 'value'
}
```

#### Result.errorOrNull()

Returns the error on failure or null on success:

```ts
// on failure...
const result = thisWillFail();
const error = result.errorOrNull(); // error is defined
// on success...
const result = thisWillSucceed();
const error = result.errorOrNull(); // error is null
```

#### Result.getOrNull()

Returns the value on success or null on failure:

```ts
// on success...
const result = thisWillSucceed();
const value = result.getOrNull(); // value is defined
// on failure...
const result = thisWillFail();
const value = result.getOrNull(); // value is null
```

#### Result.fold(onSuccess: (value) => T, onFailure: (error) => T);

Returns the result of the onSuccess-callback for the encapsulated value if this instance represents success or the result of onFailure-callback for the encapsulated error if it is failure:

```ts
const result = doStuff();
const value = result.fold(
  // on success...
  value => value * 2,
  // on failure...
  error => 4
);
```

#### Result.getOrDefault(value: T)

Returns the value on success or the return-value of the onFailure-callback on failure:

```ts
const result = doStuff();
const value = result.getOrDefault(2);
```

#### Result.getOrElse(fn: (error) => T)

Returns the value on success or the return-value of the onFailure-callback on failure:

```ts
const result = doStuff();
const value = result.getOrElse(error => 4);
```

#### Result.getOrThrow()

Returns the value on success or throws the error on failure:

```ts
const result = doStuff();
const value = result.getOrThrow();
```

#### Result.map()

Maps a result to another result.
If the result is success, it will call the callback-function with the encapsulated value, which returnr another Result.
If the result is failure, it will ignore the callback-function, and will return the initial Result (error)

```ts
class ErrorA extends Error {}
class ErrorB extends Error {}

function doA(): Result<ErrorA, number> {}
function doB(value: number): Result<ErrorB, string> {}

// nested results will flat-map to a single Result...
const result1 = doA().map(value => doB(value)); // Result<ErrorA | ErrorB, string>

// ...or transform the successful value right away
// note: underneath, the callback is wrapped inside Result.safe() in case the callback
// might throw
const result2 = doA().map(value => value * 2); // Result<ErrorA | Error, number>
```

#### Result.forward()

Creates and forwards a brand new Result out of the current error or value.
This is useful if you want to return early after failure.

```ts
class ErrorA extends Error {}
class ErrorB extends Error {}

function doA(): Result<ErrorA, number> {}
function doB(): Result<ErrorB, number> {}

function performAction(): Result<ErrorA | ErrorB, number> {
  const resultA = doA();
  if (resultA.isFailure()) {
    return resultA.forward();
  }

  const resultB = doA();
  if (resultB.isFailure()) {
    return resultB.forward();
  }

  // from here both 'a' and 'b' are valid values
  const [a, b] = [resultA.value, resultB.value];

  return a + b;
}
```

## Rollbacks

There are cases where a series of operations are performed that need to be treated as a 'unit of work'. In other words: if the last operation fails, de preceding operations should also fail, despite the fact that those preceding operations succeeded on their own. In such cases you probably want some kind of recovering a.k.a. a rollback.

Fortunately, typescript-result allows you to rollback your changes with the minimum amount of effort.

### Example

In this example we're dealing with user-data that needs to be saved within one transaction:

```ts
async function updateUserThingA(
  userId: string,
  thingA: string
): Result<Error, null> {
  try {
    // get hold of the value we're about to update
    const { thingA: oldThingA } = await db.getUser(userId);

    // run the update
    await db.updateUser(userId, { thingA });

    // We return a successful Result, AND passing a rollback function as 2nd parameter
    return Result.ok(null, async () => {
      // restore 'thingA' to the old value
      await db.updateUser(userId, { thingA: oldThingA });
    });
  } catch (e) {
    return Result.error(e);
  }
}

async function updateUserThingB(
  userId: string,
  thingB: string
): Result<Error, null> {
  /* similar implementation as 'updateUserThingA' */
}

function updateUser(userId: string, thingA: string, thingB: string) {
  const result = await Result.combine(
    () => updateUserThingA(userId, thingA),
    () => updateUserThingB(userId, thingB)
  );

  if (result.isFailure()) {
    // We received a failing result, let's rollback!
    // Since rollbacks themselves can also fail, we also receive a Result indicating whether the rollback succeeded or not
    const rollbackResult = await result.rollback();

    if (rollbackResult.isFailure()) {
      // something is seriously wrong!
      return `Unexpected error!`;
    }

    return `Could not update the user :(`;
  }

  return "Successfully updated the user!";
}
```
