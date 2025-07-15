# Verify a one-time password (OTP)

This example demonstrates how to verify a one-time password for user authentication. The verification process includes checking if the user exists, ensuring they're active, validating their authentication method configuration, and verifying the provided OTP code.

::: code-group

```ts twoslash [Chaining style]
import { type AsyncResult, Result } from "typescript-result";
// ---cut-start---
class NotFoundError extends Error {
  readonly type = "not-found-error";
}

class UserNotActiveError extends Error {
  readonly type = "user-not-active-error";
}

class InvalidAuthMethodError extends Error {
  readonly type = "invalid-auth-method-error";
}

class InvalidOneTimePasswordError extends Error {
  readonly type = "invalid-one-time-password-error";
}
// ---cut-end---

interface PasswordAuthMethod {
  type: "password";
  password: string;
}

interface OneTimePasswordAuthMethod {
  type: "one-time-password";
  challenge: {
    code: string;
    expiresAt: Date;
  } | null;
}

interface User {
  id: string;
  status: "active" | "inactive";
  email: string;
  authMethods: (PasswordAuthMethod | OneTimePasswordAuthMethod)[];
}

declare function findUserById(id: string): AsyncResult<User, NotFoundError>;

function verifyOneTimePassword(userId: string, code: string) {
  return findUserById(userId).map((user) => {
    if (user.status !== "active") {
      return Result.error(
        new UserNotActiveError("Cannot verify OTP for inactive user"),
      );
    }

    const authMethod = user.authMethods.find(
      (method) => method.type === "one-time-password",
    );
    if (!authMethod) {
      return Result.error(
        new InvalidAuthMethodError(
          "User has not configured one-time password as auth method",
        ),
      );
    }

    if (!authMethod.challenge) {
      return Result.error(
        new InvalidAuthMethodError(
          "User has not requested a one-time password challenge",
        ),
      );
    }

    if (authMethod.challenge.code !== code) {
      return Result.error(
        new InvalidOneTimePasswordError("Invalid one-time password"),
      );
    }

    return Result.ok();
  });
}

const result = await verifyOneTimePassword("user-id", "123456")
//    ^?
```

```ts twoslash [Generator style]
import { type AsyncResult, Result } from "typescript-result";
// ---cut-start---
class NotFoundError extends Error {
  readonly type = "not-found-error";
}

class UserNotActiveError extends Error {
  readonly type = "user-not-active-error";
}

class InvalidAuthMethodError extends Error {
  readonly type = "invalid-auth-method-error";
}

class InvalidOneTimePasswordError extends Error {
  readonly type = "invalid-one-time-password-error";
}
// ---cut-end---

interface PasswordAuthMethod {
  type: "password";
  password: string;
}

interface OneTimePasswordAuthMethod {
  type: "one-time-password";
  challenge: {
    code: string;
    expiresAt: Date;
  } | null;
}

interface User {
  id: string;
  status: "active" | "inactive";
  email: string;
  authMethods: (PasswordAuthMethod | OneTimePasswordAuthMethod)[];
}

declare function findUserById(id: string): AsyncResult<User, NotFoundError>;

function verifyOneTimePassword(userId: string, code: string) {
  return Result.gen(function* () {
    const user = yield* findUserById(userId);

    if (user.status !== "active") {
      return Result.error(
        new UserNotActiveError("Cannot verify OTP for inactive user"),
      );
    }

    const authMethod = user.authMethods.find(
      (method) => method.type === "one-time-password",
    );
    if (!authMethod) {
      return Result.error(
        new InvalidAuthMethodError(
          "User has not configured one-time password as auth method",
        ),
      );
    }

    if (!authMethod.challenge) {
      return Result.error(
        new InvalidAuthMethodError(
          "User has not requested a one-time password challenge",
        ),
      );
    }

    if (authMethod.challenge.code !== code) {
      return Result.error(
        new InvalidOneTimePasswordError("Invalid one-time password"),
      );
    }

    return;
  });
}

const result = await verifyOneTimePassword("user-id", "123456")
//    ^?
```

```ts twoslash [Errors]
class NotFoundError extends Error {
  readonly type = "not-found-error";
}

class UserNotActiveError extends Error {
  readonly type = "user-not-active-error";
}

class InvalidAuthMethodError extends Error {
  readonly type = "invalid-auth-method-error";
}

class InvalidOneTimePasswordError extends Error {
  readonly type = "invalid-one-time-password-error";
}
```