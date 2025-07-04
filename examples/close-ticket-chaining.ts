import { randomUUID, type UUID } from "node:crypto";
import { Result } from "typescript-result";
import { sleep } from "./util.js";

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
}

function findTicketById(id: UUID) {
	return Result.fromAsync(async () => {
		sleep(100); // Simulate database lookup

		if (Math.random() < 0.5) {
			return Result.error(new NotFoundError(`Ticket with ID ${id} not found`));
		}

		return Result.ok(SupportTicket.create() as Ticket);
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

const result = await closeTicket(randomUUID(), TicketClosedReason.Resolved);

console.log(
	result.fold(
		() => "Ticket closed successfully",
		(error) => {
			switch (error.type) {
				case "invalid-ticket-type-error":
					return `Not found: ${error.message}`;
				case "validation-error":
					return `Validation Error: ${error.message}`;
				case "not-found-error":
				case "invalid-status-transition-error":
					return `Error: ${error.message}`;
			}
		},
	),
);
