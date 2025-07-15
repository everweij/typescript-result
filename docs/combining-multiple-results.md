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