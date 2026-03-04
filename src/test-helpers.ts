export class CustomError extends Error {}

export class ErrorA extends Error {
	readonly type = "a";
}

export class ErrorB extends Error {
	readonly type = "b";
}

export class ErrorC extends Error {
	readonly type = "c";
}

export const errorA = new ErrorA("some error");

export const sleep = () => new Promise((resolve) => setTimeout(resolve, 10));
