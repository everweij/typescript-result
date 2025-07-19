<img alt="TypeScript Result logo" width="84px" src="./assets/typescript-result-logo.svg" />

# TypeScript Result

[![NPM](https://img.shields.io/npm/v/typescript-result.svg)](https://www.npmjs.com/package/typescript-result)
[![TYPESCRIPT](https://img.shields.io/badge/%3C%2F%3E-typescript-blue)](http://www.typescriptlang.org/)
[![BundleJS](https://deno.bundlejs.com/badge?q=typescript-result)](https://bundlejs.com/?q=typescript-result)
[![Weekly downloads](https://badgen.net/npm/dw/typescript-result)](https://badgen.net/npm/dw/typescript-result)

Supercharge your TypeScript error handling with a powerful Result type that transforms chaotic try-catch blocks into elegant, type-safe code—catching bugs at compile time while making async operations seamless and your code much harder to break.

## Features

- **🐞 Catch bugs at compile time**
  
  TypeScript's type system tracks every possible failure scenario and forces you to handle them

- **🧩 Simple and tiny, yet very powerful**

  Thanks to the polymorphic operators, you only need to learn a few methods. And notice the small footprint: Only 1.9 KB minified and gzipped.

- **✨ Full type inference without boilerplate**

  Just return `Result.ok()` or `Result.error()` and let TypeScript do the heavy lifting

- **⚡ Seamless async support**

  Work with async operations without constant `await` calls through automatic `AsyncResult` conversion

- **🔗 Chaining and generator styles**

- **📦 Zero dependencies**


## Links

- [Docs](https://www.typescript-result.dev/)
- [Examples](https://www.typescript-result.dev/examples/)
- [Playground](https://www.typescript-result.dev/playground/)

## Example

Reading a JSON config file and validating its contents:

```typescript
import fs from "node:fs/promises";
import { Result } from "typescript-result";
import { s } from "some-schema-validation-library";

class IOError extends Error {
  readonly type = "io-error";
}

class ParseError extends Error {
  readonly type = "parse-error";
}

class ValidationError extends Error {
  readonly type = "validation-error";
}

const readFile = Result.wrap(
  (filePath: string) => fs.readFile(filePath, "utf-8"),
  (error) => new IOError(`Unable to read file`, { cause: error }),
);

const parseConfig = Result.wrap(
  (data: unknown) =>
    s
      .object({
        name: s.string().min(1),
        version: s.number().int().positive(),
      })
      .parse(data),
  (error) => new ValidationError(`Invalid configuration`, { cause: error }),
);

// chaining style:
const result = await readFile("config.json")
  .mapCatching(
    (contents) => JSON.parse(contents),
    (error) => new ParseError("Unable to parse JSON", { cause: error }),
  )
  .map((json) => parseConfig(json));

// generator style:
const result = await Result.gen(function* () {
  const contents = yield* readFile("config.json");

  const json = yield* Result.try(
    () => JSON.parse(contents),
    (error) => new ParseError("Unable to parse JSON", { cause: error }),
  );

  return parseConfig(json);
});

if (!result.ok) {
  return result
    .match()
    .when(IOError, () => "Please check if the config file exists and is readable")
    .when(ParseError, () => "Please check if the config file contains valid JSON")
    .when(ValidationError, (error) => `Invalid config: ${error.message}`)
    .run();
}

const { name, version } = result.value;
return `Successfully read config: name => ${name}, version => ${version}`;
```

For more examples, please check out the other [examples](https://www.typescript-result.dev/examples/).


## Installation

Install using your favorite package manager:

```sh
npm install typescript-result
```

## Requirements

### Typescript

Technically Typescript with version `4.8.0` or higher should work, but we recommend using version >= `5` when possible.

Also it is important that you have `strict` or `strictNullChecks` enabled in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### Runtimes

Tested with Node.js version `16` and higher, but this library should work with all modern browsers/runtimes.