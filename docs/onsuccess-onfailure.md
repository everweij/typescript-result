# `onSuccess` and `onFailure`

These methods allow you to perform _side effects_ based on the success or failure of a `Result`. They are useful for logging, notifications, or any other action that should occur without altering the result itself.

```ts
declare const result: Result<string, Error>;

const nextResult = result
  .onSuccess((value) => console.log("Operation succeeded with value", value))
  .onFailure((error) => console.error("Operation failed with error", error));
```

::: info
Regardless of what the callback returns, the original `Result` is returned unchanged.
:::

::: warning
These methods do **_not_** catch any thrown exceptions. If you feel the need to capture any errors inside the callback, it may be a smell that you should use `mapCatching` instead.
:::

::: info
If you need to perform a side effect for a specific case, it is recommended to use a _nesting_ approach as shown below:

```ts
declare const result: Result<string, ErrorA>;
declare const otherResult: Result<string, ErrorA>;

const nextResult = result.map(() => 
  otherResult.onSuccess((value) => console.log("Other operation succeeded with value", value))
);
```

:::
