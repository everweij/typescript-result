---
outline: false
---

# What is a result type?

The result type is a concept rooted in functional programming that has gained popularity in recent years through languages like Rust. Let's skip the functional jargon for a moment and picture a result type as a **box** that can contain either a _successful_ or _failed_ outcome of an operation. This box can be opened to check whether the operation succeeded or failed, and if it failed, it can provide information about the error that occurred. Since _unwrapping_ the box to peek at its contents between various operations can quickly become cumbersome, most result types provide ways to work with the box's contents without having to open it every time.

High-level, it works like this:

```typescript
type Result<T, E> = {
  ok: true;
  value: T;
} | {
  ok: false;
  error: E;
};

declare function someOperation(): Result<string, Error>;
```

## Errors as values

Instead of throwing exceptions where all errors are treated equally and disrupt your program's flow, the result type embraces the 'errors-as-values' approach from functional programming or languages like Go. This lets you distinguish between expected errors (like "user not found") and unexpected ones (like system crashes), making expected errors part of your normal program flow.

By explicitly marking code that can succeed or fail with the Result type, TypeScript's type system tracks every possible failure scenario and forces you to handle them—catching bugs at compile time through exhaustive checking. This makes your code more reliable, maintainable, and transparent about what can go wrong.