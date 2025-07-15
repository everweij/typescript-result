# Close a support ticket

This example demonstrates how to close a support ticket in a ticketing system. The process includes finding the ticket by ID, validating its type and status, and then closing it with a specified reason. The code handles various error scenarios such as ticket not found, invalid ticket type, and invalid status transitions.

::: info
Note that this is a rather lengthy example, but it showcases the power of the `typescript-result` library in handling realistic workflows with multiple error types and validations.
:::

::: code-group

```ts twoslash [Chaining style]
import { Result } from "typescript-result";
// ---cut-start---
type UUID = string;
declare function randomUUID(): UUID;
declare function fakeDatabaseLookup(id: UUID): Promise<Ticket | null>;

class NotFoundError extends Error {
  readonly type = "not-found-error";
}

class InvalidTicketTypeError extends Error {
  readonly type = "invalid-ticket-type-error";
}

class InvalidStatusTransitionError extends Error {
  readonly type = "invalid-status-transition-error";
}

class ValidationError extends Error {
  readonly type = "validation-error";
}
// ---cut-end---

enum TicketStatus {
  Open = "open",
  Closed = "closed",
}

enum TicketClosedReason {
  Resolved = "resolved",
  Duplicate = "duplicate",
  Other = "other",
}

enum TicketType {
  Support = "support",
  Bug = "bug",
  Feature = "feature",
}

type AnyTicket = SupportTicket | BugTicket;

abstract class Ticket {
  abstract id: UUID;
  abstract status: TicketStatus;
  abstract type: TicketType;

  assertType<T extends TicketType>(type: T) {
    if (this.type !== type) {
      return Result.error(
        new InvalidTicketTypeError(
          `Expected ticket type ${type}, but got ${this.type}`,
        ),
      );
    }

    return Result.ok(this as unknown as Extract<AnyTicket, { type: T }>);
  }

  assertStatus(status: TicketStatus) {
    if (this.status !== status) {
      return Result.error(
        new InvalidStatusTransitionError(
          `Expected ticket status ${status}, but got ${this.status}`,
        ),
      );
    }

    return Result.ok(this);
  }
}

class SupportTicket extends Ticket {
  readonly type = TicketType.Support;

  private constructor(
    public readonly id: UUID,
    public status: TicketStatus,
    public closedReason: TicketClosedReason | null,
    public closedReasonDescription: string | null,
  ) {
    super();
  }

  close(reason: TicketClosedReason, description?: string) {
    return this.assertStatus(TicketStatus.Open).map(() => {
      if (this.closedReason === TicketClosedReason.Other && !description) {
        return Result.error(
          new ValidationError("Description is required for 'Other' reason"),
        );
      }

      this.status = TicketStatus.Closed;
      this.closedReason = reason;
      this.closedReasonDescription = description ?? null;

      return Result.ok();
    });
  }

  static create() {
    return new SupportTicket(randomUUID(), TicketStatus.Open, null, null);
  }
}

class BugTicket extends Ticket {
  readonly type = TicketType.Bug;

  constructor(
    public readonly id: UUID,
    public status: TicketStatus,
  ) {
    super();
  }

  // Additional logic related to BugTicket here...
}

function findTicketById(id: UUID) {
  return Result.fromAsync(async () => {
    const ticket = await fakeDatabaseLookup(id);

    if (!ticket) {
      return Result.error(new NotFoundError(`Ticket with ID ${id} not found`));
    }

    return Result.ok(ticket);
  });
}

function closeTicket(
  ticketId: UUID,
  reason: TicketClosedReason,
  description?: string,
) {
  return findTicketById(ticketId)
    .map((ticket) => ticket.assertType(TicketType.Support))
    .map((supportTicket) => supportTicket.close(reason, description));
}

const result = await closeTicket("ticket-123", TicketClosedReason.Resolved);
//    ^?
```

```ts twoslash [Generator style]
import { Result } from "typescript-result";
// ---cut-start---
type UUID = string;
declare function randomUUID(): UUID;
declare function fakeDatabaseLookup(id: UUID): Promise<Ticket | null>;

class NotFoundError extends Error {
  readonly type = "not-found-error";
}

class InvalidTicketTypeError extends Error {
  readonly type = "invalid-ticket-type-error";
}

class InvalidStatusTransitionError extends Error {
  readonly type = "invalid-status-transition-error";
}

class ValidationError extends Error {
  readonly type = "validation-error";
}
// ---cut-end---

enum TicketStatus {
  Open = "open",
  Closed = "closed",
}

enum TicketClosedReason {
  Resolved = "resolved",
  Duplicate = "duplicate",
  Other = "other",
}

enum TicketType {
  Support = "support",
  Bug = "bug",
  Feature = "feature",
}

type AnyTicket = SupportTicket | BugTicket;

abstract class Ticket {
  abstract id: UUID;
  abstract status: TicketStatus;
  abstract type: TicketType;

  assertType<T extends TicketType>(type: T) {
    if (this.type !== type) {
      return Result.error(
        new InvalidTicketTypeError(
          `Expected ticket type ${type}, but got ${this.type}`,
        ),
      );
    }

    return Result.ok(this as unknown as Extract<AnyTicket, { type: T }>);
  }

  assertStatus(status: TicketStatus) {
    if (this.status !== status) {
      return Result.error(
        new InvalidStatusTransitionError(
          `Expected ticket status ${status}, but got ${this.status}`,
        ),
      );
    }

    return Result.ok(this);
  }
}

class SupportTicket extends Ticket {
  readonly type = TicketType.Support;

  private constructor(
    public readonly id: UUID,
    public status: TicketStatus,
    public closedReason: TicketClosedReason | null,
    public closedReasonDescription: string | null,
  ) {
    super();
  }

  *close(reason: TicketClosedReason, description?: string) {
    yield* this.assertStatus(TicketStatus.Open);

    if (this.closedReason === TicketClosedReason.Other && !description) {
      return yield* Result.error(
        new ValidationError("Description is required for 'Other' reason"),
      );
    }

    this.status = TicketStatus.Closed;
    this.closedReason = reason;
    this.closedReasonDescription = description ?? null;
  }

  static create() {
    return new SupportTicket(randomUUID(), TicketStatus.Open, null, null);
  }
}

class BugTicket extends Ticket {
  readonly type = TicketType.Bug;

  constructor(
    public readonly id: UUID,
    public status: TicketStatus,
  ) {
    super();
  }
  
  // Additional logic related to BugTicket here...
}

function findTicketById(id: UUID) {
  return Result.fromAsync(async () => {
    const ticket = await fakeDatabaseLookup(id);

    if (!ticket) {
      return Result.error(new NotFoundError(`Ticket with ID ${id} not found`));
    }

    return Result.ok(ticket);
  });
}

function closeTicket(
  ticketId: UUID,
  reason: TicketClosedReason,
  description?: string,
) {
  return Result.gen(async function* () {
    const ticket = yield* findTicketById(ticketId);
    const supportTicket = yield* ticket.assertType(TicketType.Support);
    yield* supportTicket.close(reason, description);
  });
}

const result = await closeTicket("ticket-123", TicketClosedReason.Resolved);
//    ^?
```

```ts twoslash [Errors]
class NotFoundError extends Error {
  readonly type = "not-found-error";
}

class InvalidTicketTypeError extends Error {
  readonly type = "invalid-ticket-type-error";
}

class InvalidStatusTransitionError extends Error {
  readonly type = "invalid-status-transition-error";
}

class ValidationError extends Error {
  readonly type = "validation-error";
}
```

:::