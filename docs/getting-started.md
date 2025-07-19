---
outline: [2,3]
---

# Getting started

## Installation

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

Tested with [Node.js](https://nodejs.org/) version `16` and higher.

### Install the library

You can install the library using your favorite package manager.

::: code-group

```sh [npm]
$ npm add typescript-result
```

```sh [pnpm]
$ pnpm add typescript-result
```

```sh [yarn]
$ yarn add typescript-result
```

```sh [bun]
$ bun add typescript-result
```

:::

## Your first Result

Let's start by refactoring a function that reads a file and parses its content:

```typescript
function readConfig(filePath: string): Config {
  const contents = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(contents);
}
```

This code has a serious flaw: multiple things can go wrong, but the function signature gives no indication of this. The consumer expects this function to always return a `Config` object, but what happens when the file doesn't exist? What if the contents aren't valid JSON? What if the JSON structure doesn't match the expected `Config` shape?

Let's refactor this code using a `Result` type to make these potential failures **explicit**.

### Defining errors

First, we need to define some errors so what we can distinguish between different error cases:

```ts
class IOError extends Error {
  readonly type = "io-error";
}

class ParseError extends Error {
  readonly type = "parse-error";
}

class ValidationError extends Error {
  readonly type = "validation-error";
}
```

::: info
Please disregard the `readonly type` property in the error classes for now. It's not necessary for the library to work, but it can be useful for type narrowing and debugging purposes.
For more information, see [A note on errros](/a-note-on-errors).
:::

### Returning a Result

With these error classes in place, we can now express the _outcome_ of the `readConfig` function as a `Result` type. In case of a caught error, we will return a `Result.error()` with the appropriate error. In case of success, we will return a `Result.ok()` with the parsed configuration object.

```typescript twoslash
import { Result } from "typescript-result";

class IOError extends Error {
  readonly type = "io-error";
}

class ParseError extends Error {
  readonly type = "parse-error";
}

class ValidationError extends Error {
  readonly type = "validation-error";
}

declare namespace fs {
  function readFileSync(filePath: string, encoding: string): string;
}
declare function parseConfig(data: unknown): Config;

// ---cut-before---
type Config = {
  name: string;
  version: number;
}

function readConfig(filePath: string) {
  let contents: string;
  try {
    contents = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    return Result.error(
      new IOError(`Unable to read file: ${filePath}`, { cause: error })
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(contents);
  } catch (error) {
    return Result.error(
      new ParseError(`Unable to parse JSON from file: ${filePath}`)
    );
  }

  try {
    const config = parseConfig(json);
    return Result.ok(config);
  } catch (error) {
    return Result.error(
      new ValidationError(
        `Invalid configuration in file: ${filePath}`, 
        { cause: error }
      )
    );
  }
}

const result = readConfig("config.json");
//     ^?
```

<div class="spacer" />

If you look at the final `result`, you'll see exactly what the outcome of the function can be. And while technically the above code is correct, it is very verbose. Luckily, the library provides a way to make this code more concise.

### Adding the `Result.try` helper

First, we will introduce the `Result.try` helper function. This function is basically a wrapper around the `try/catch` block that allows us to handle errors in a more concise way. It tries to execute the provided function and wrap the returned value in a `Result.ok()`, or catch any errors and wrap them in a `Result.error()`. Optionally, you can provide a second callback function that allows you to transform the error before wrapping it in a `Result.error()`. Let's see how this looks:


```typescript twoslash
import { Result } from "typescript-result";

class IOError extends Error {
  readonly type = "io-error";
}

class ParseError extends Error {
  readonly type = "parse-error";
}

class ValidationError extends Error {
  readonly type = "validation-error";
}

declare namespace fs {
  function readFileSync(filePath: string, encoding: string): string;
}
declare function parseConfig(data: unknown): Config;

type Config = {
  name: string;
  version: number;
}
// ---cut-before---
function readConfig(filePath: string) {
  const contentResult = Result.try(
    () => fs.readFileSync(filePath, "utf-8"),
    (error) => new IOError(`Unable to read file: ${filePath}`, { cause: error })
  );
  if (!contentResult.ok) {
    return contentResult;
  }

  const jsonResult = Result.try(
    () => JSON.parse(contentResult.value),
    () => new ParseError(`Unable to parse JSON from file: ${filePath}`)
  );
  if (!jsonResult.ok) {
    return jsonResult;
  }
  
  const configResult = Result.try(
    () => parseConfig(jsonResult.value),
    (error) => new ValidationError(
      `Invalid configuration in file: ${filePath}`, 
      { cause: error }
    )
  );

  return configResult;
}
```

### Extracting steps with `Result.wrap`

Ok, no more `try/catch` blocks, but the code is still very verbose. To improve readability, we can extract each step into a separate function. This will allow us to focus on the main logic of the `readConfig` function without getting lost in the details of error handling. This is where `Result.wrap` comes in handy. This is very similar to `Result.try`, but instead of executing a function directly, it returns a function instead:

```typescript twoslash
import { Result } from "typescript-result";

class IOError extends Error {
  readonly type = "io-error";
}

class ParseError extends Error {
  readonly type = "parse-error";
}

class ValidationError extends Error {
  readonly type = "validation-error";
}

declare namespace fs {
  function readFileSync(filePath: string, encoding: string): string;
}

type Config = {
  name: string;
  version: number;
}
// ---cut-before---
const readFile = Result.wrap(
  (filePath: string) => fs.readFileSync(filePath, "utf-8"),
  (error) => new IOError(`Unable to read file`, { cause: error }),
);

const parseJSON = Result.wrap(
  (data: string) => JSON.parse(data) as unknown,
  () => new ParseError(`Unable to parse JSON`)
);

const parseConfig = Result.wrap(
  (data: unknown) => {
    /* skipped for brevity */
    return data as Config;
  },
  (error) => new ValidationError(`Invalid configuration`, { cause: error }),
);

function readConfig(filePath: string) {
  const contentResult = readFile(filePath);
  if (!contentResult.ok) {
    return contentResult;
  }

  const jsonResult = parseJSON(contentResult.value);
  if (!jsonResult.ok) {
    return jsonResult;
  }
  
  return parseConfig(jsonResult.value);
}
```

### Chaining operations

This is a step in the right direction, but we can still improve the code further. Did you notice how we check for errors after each step? This is a pattern both loved and hated in languages like Go. While it makes things explicit, it can also lead to a lot of boilerplate code. To make our code more ergonomic, we can introduce _chaining_: performing multiple operations on a `Result` instance in a more concise way. In 90% of the cases `Result.map()` is the method you want to use. Let's see how this works in practice:

```typescript twoslash
import { Result } from "typescript-result";

class IOError extends Error {
  readonly type = "io-error";
}

class ParseError extends Error {
  readonly type = "parse-error";
}

class ValidationError extends Error {
  readonly type = "validation-error";
}

declare namespace fs {
  function readFileSync(filePath: string, encoding: string): string;
}

type Config = {
  name: string;
  version: number;
}

const readFile = Result.wrap(
  (filePath: string) => fs.readFileSync(filePath, "utf-8"),
  (error) => new IOError(`Unable to read file`, { cause: error }),
);

const parseJSON = Result.wrap(
  (data: string) => JSON.parse(data) as unknown,
  () => new ParseError(`Unable to parse JSON`)
);

const parseConfig = Result.wrap(
  (data: unknown) => {
    /* skipped for brevity */
    return data as Config;
  },
  (error) => new ValidationError(`Invalid configuration`, { cause: error }),
);

// ---cut-before---
function readConfig(filePath: string) {
  return readFile(filePath)
    .map((contents) => parseJSON(contents))
    .map((json) => parseConfig(json));
}
```

::: info
Most operations on `Result` instances are polymorphic, meaning you can return different types of values from them — literal values, promises, or even other `Result` instances as shown above. This flexibility makes it easy to compose operations and build complex workflows.
:::

::: tip
If you have worked with `typescript-result` for a while, you'll notice that often there are multiple ways to achieve the same result. This is intentional, as we want to provide you with the flexibility to choose the approach that best fits your use case. The library is designed to be ergonomic and easy to use, so you can focus on writing clean and maintainable code.

To illustrate this point, we could have 'inlined' the json parsing using `mapCatching` for instance, instead of extracting it into a separate function:

```typescript
function readConfig(filePath: string) {
  return readFile(filePath)
    .mapCatching(
      (contents) => JSON.parse(contents),
      () => new ParseError(`Unable to parse JSON`)
    )
    .map((json) => parseConfig(json));
}
```
:::

### (Optional) 'do-style' syntax using generators

Remember this pattern from a few examples back?

```typescript
const result = operation();
if (!result.ok) {
  return result;
}
```

With Rust you can use the [`?` operator](https://doc.rust-lang.org/rust-by-example/std/result/question_mark.html) to make this more concise, but in TypeScript we don't have that luxury. However, we can use generator functions to achieve a similar effect. This is an optional feature of the library, and you can choose to use it or not. For more information, see [Chaining vs. generator syntax](/chaining-vs-generator-syntax#using-generators).

Here's a quick example of how this works:

```typescript twoslash
import { Result } from "typescript-result";

class IOError extends Error {
  readonly type = "io-error";
}

class ParseError extends Error {
  readonly type = "parse-error";
}

class ValidationError extends Error {
  readonly type = "validation-error";
}

declare namespace fs {
  function readFileSync(filePath: string, encoding: string): string;
}

type Config = {
  name: string;
  version: number;
}

const readFile = Result.wrap(
  (filePath: string) => fs.readFileSync(filePath, "utf-8"),
  (error) => new IOError(`Unable to read file`, { cause: error }),
);

const parseJSON = Result.wrap(
  (data: string) => JSON.parse(data) as unknown,
  () => new ParseError(`Unable to parse JSON`)
);

const parseConfig = Result.wrap(
  (data: unknown) => {
    /* skipped for brevity */
    return data as Config;
  },
  (error) => new ValidationError(`Invalid configuration`, { cause: error }),
);

// ---cut-before---
function* readConfig(filePath: string) {
  const contents = yield* readFile(filePath);
  const json = yield* parseJSON(contents);
  const config = yield* parseConfig(json);
  return config;
}

const result = Result.gen(readConfig("config.json"));
//    ^?
```

### Next steps

Hopefully this gives you a good idea of how to get started with `typescript-result`.
For more information on how to use this library, please continue with the [guide](/a-note-on-errors). If you want to see more examples, check out the [examples](/examples/). Ready to give it a spin? Try it out for yourself in our [playground](/playground).