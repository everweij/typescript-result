# Parse JSON config

This example demonstrates how to parse a JSON configuration file with proper error handling using the chaining or generator style. The process involves reading a file, parsing JSON, and validating the structure - each step can fail with different error types.

::: code-group

```ts twoslash [Chaining style]
import { Result } from "typescript-result";
// ---cut-start---
declare namespace fs {
  function readFile(filePath: string, encoding: string): Promise<string>;
}
class IOError extends Error {
  readonly type = "io-error";
}

class ParseError extends Error {
  readonly type = "parse-error";
}

class ValidationError extends Error {
  readonly type = "validation-error";
}

// ---cut-end---

type Config = {
  name: string;
  version: number;
}

const readFile = Result.wrap(
  (filePath: string) => fs.readFile(filePath, "utf-8"),
  (error) => new IOError(`Unable to read file`, { cause: error }),
);

const parseConfig = Result.wrap(
  (data: unknown) => {
    /* your favorite schema validation lib here */
    return data as Config;
  },
  (error) => new ValidationError(`Invalid configuration`, { cause: error }),
);

function getConfig(path: string) {
  return readFile(path)
    .mapCatching(
      (contents) => JSON.parse(contents),
      (error) => new ParseError("Unable to parse JSON", { cause: error }),
    )
    .map((json) => parseConfig(json));
}

const result = await getConfig("config.json");
//     ^?
```

```ts twoslash [Generator style]
import { Result } from "typescript-result";
// ---cut-start---
declare namespace fs {
  function readFile(filePath: string, encoding: string): Promise<string>;
}
class IOError extends Error {
  readonly type = "io-error";
}

class ParseError extends Error {
  readonly type = "parse-error";
}

class ValidationError extends Error {
  readonly type = "validation-error";
}
// ---cut-end---

type Config = {
  name: string;
  version: number;
}

const readFile = Result.wrap(
  (filePath: string) => fs.readFile(filePath, "utf-8"),
  (error) => new IOError(`Unable to read file`, { cause: error }),
);

const parseConfig = Result.wrap(
  (data: unknown) => {
    /* your favorite schema validation lib here */
    return data as Config;
  },
  (error) => new ValidationError(`Invalid configuration`, { cause: error }),
);

function* getConfig(path: string) {
  const contents = yield* readFile(path);

  const json = yield* Result.try(
    () => JSON.parse(contents),
    (error) => new ParseError("Unable to parse JSON", { cause: error }),
  );

  return parseConfig(json);
}

const result = await Result.gen(getConfig("config.json"));
//    ^?
```

``` ts twoslash [Errors]
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

:::