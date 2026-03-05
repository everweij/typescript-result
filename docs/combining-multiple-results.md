# Combining multiple results

In some cases you might want to combine multiple results into a single result. This can be done using the `Result.all` and `Result.allCatching` methods. The `Result.all` method will return a successful result if all results are successful, otherwise it will return the first error that occurred. This is especially useful when you want to run multiple independent operations and bundle the outcome into a single result:

```ts twoslash
import { Result, AsyncResult } from "typescript-result";

class IOError extends Error {
  readonly type = "io-error";
}

type Task = {
  id: number;
  name: string;
};

declare function createTask(name: string): AsyncResult<Task, IOError>;

const tasks = ["task-a", "task-b", "task-c"];
const result = Result.all(...tasks.map(createTask));
//    ^?
```

<div class="spacer" />

Due to its polymorphic nature, `Result.all` is very flexible. It can handle both synchronous and asynchronous results, and it can even work with other `Result`/`AsyncResult` instances or generators. This means you can use it to combine results from different sources, such as API calls, database queries, or any other operation that returns a value:

```ts twoslash
import { type AsyncResult, Result } from "typescript-result";

type UserProfile = {
	name: string;
	age: number;
	imageUrl: string;
};

type OrganizationInfo = {
	name: string;
};

type UserPreferences = {
	theme: string;
	notifications: boolean;
};

class FetchError extends Error {
	readonly type = "fetch-error";
}

class NotFoundError extends Error {
	readonly type = "not-found-error";
}

declare function fetchUserProfile(
	userId: number,
): AsyncResult<UserProfile, FetchError | NotFoundError>;
declare function fetchOrganizationInfo(
	userId: number,
): AsyncResult<OrganizationInfo, FetchError | NotFoundError>;
declare function fetchUserPreferences(
	userId: number,
): AsyncResult<UserPreferences, FetchError | NotFoundError>;

// ---cut-before---
const userId = 123;

const result = Result.all(
	fetchUserProfile(userId), // AsyncResult
	fetchOrganizationInfo(userId), // AsyncResult
	fetchUserPreferences(userId), // AsyncResult
);

const nextResult = result.map(
	([profile, organization, preferences]) => {
		return {
			userId,
			...profile,
			organization,
			preferences,
		};
	},
);
```

::: info
`Result.all` determines whether it should return an `AsyncResult` or `Result` based on the provided arguments: if all arguments are synchronous, it returns a `Result`. If any argument is asynchronous, it returns an `AsyncResult`.
:::

Example - running multiple operations and combining the results:
```ts twoslash
import { Result } from "typescript-result";

const result = Result.all(
  "a" as const,
  Promise.resolve("b" as const),
  Result.ok("c" as const),
  Result.try(async () => "d" as const),
  () => "e" as const,
  () => Result.try(async () => "f" as const),
  () => Result.ok("g" as const),
  async () => "h" as const,
  function *() { return "i" as const; }
); // AsyncResult<["a", "b", "c", "d", "e", "f", "g", "h", "i"], Error>
```

## Result.any

Where `Result.all` requires **every** operation to succeed, `Result.any` requires just **one**. Think of it as the `Promise.any` equivalent for results: it returns the **first success**, or a **tuple of all errors** if everything fails. This makes it ideal for fallback patterns where you have multiple ways to get the same data:

```ts twoslash
import { Result, AsyncResult } from "typescript-result";

class CacheMissError extends Error {
  readonly type = "cache-miss";
}

class DbError extends Error {
  readonly type = "db-error";
}

type User = {
  id: number;
  name: string;
};

declare function fetchFromCache(id: number): Result<User, CacheMissError>;
declare function fetchFromDb(id: number): AsyncResult<User, DbError>;

// ---cut-before---
const user = Result.any(
  fetchFromCache(1),  // fast but might miss
  fetchFromDb(1),     // slower but reliable
);
```

<div class="spacer" />

Just like `Result.all`, `Result.any` is polymorphic — it accepts literal values, functions, `Result`/`AsyncResult` instances, promises, and generators in any combination:

```ts twoslash
import { Result } from "typescript-result";

const result = Result.any(
  Result.error("nope"),
  () => Result.error("also nope"),
  Promise.resolve("fallback value"),
  42,
); // AsyncResult<string | number, [string, never, never, never]>
```

::: info
`Result.any` follows the same sync/async rules as `Result.all`: if all arguments are synchronous it returns a `Result`, otherwise it returns an `AsyncResult`.
:::

### Result.anyCatching

If any of your fallback operations might throw, use `Result.anyCatching` to catch those exceptions and include them in the error tuple instead of letting them propagate:

```ts twoslash
import { Result } from "typescript-result";

const result = Result.anyCatching(
  () => { throw new Error("boom"); },
  () => Result.ok("recovered"),
);
```