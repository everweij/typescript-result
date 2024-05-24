import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	splitting: false,
	sourcemap: true,
	clean: true,
	format: ["esm", "cjs"],
	target: "esnext",
	dts: true
});
