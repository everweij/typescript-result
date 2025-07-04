import fs from "node:fs/promises";
import { Result } from "typescript-result";
import { z } from "zod";

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
		z
			.object({
				name: z.string().min(1),
				version: z.number().int().positive(),
			})
			.parse(data),
	(error) => new ValidationError(`Invalid configuration`, { cause: error }),
);

const result = await Result.gen(function* () {
	const contents = yield* readFile("config.json");

	const json = yield* Result.try(
		() => JSON.parse(contents),
		(error) => new ParseError("Unable to parse JSON", { cause: error }),
	);

	return parseConfig(json);
});

const message = result.fold(
	(config) =>
		`Successfully read config: name => ${config.name}, version => ${config.version}`,
	(error) => {
		switch (error.type) {
			case "io-error":
				return "Please check if the config file exists and is readable";
			case "parse-error":
				return "Please check if the config file contains valid JSON";
			case "validation-error":
				return error.message;
		}
	},
);

console.log(message);
