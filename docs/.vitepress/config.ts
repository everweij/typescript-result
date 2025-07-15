import { transformerTwoslash } from "@shikijs/vitepress-twoslash";
import { defineConfig } from "vitepress";
import typedocSidebar from "../api/typedoc-sidebar.json";

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: "TypeScript Result",
	description:
		"Supercharge your TypeScript error handling with a powerful Result type that transforms chaotic try-catch blocks into elegant, type-safe code.",
	head: [
		[
			"link",
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/typescript-result-logo.svg",
			},
		],
	],
	cleanUrls: true,
	themeConfig: {
		logo: "./typescript-result-logo.svg",
		search: {
			provider: "local",
		},
		nav: [
			{ text: "Docs", link: "/getting-started" },
			{ text: "Examples", link: "/examples" },
			{ text: "Playground", link: "/playground" },
		],

		sidebar: {
			"/examples": [
				{
					text: "Examples",
					items: [
						{ text: "Parse JSON config", link: "/examples/" },
						{ text: "Transcribe a video", link: "/examples/transcribe-video" },
						{
							text: "Verify a one-time-password",
							link: "/examples/verify-one-time-password",
						},
						{
							text: "Close a support ticket",
							link: "/examples/close-a-ticket",
						},
					],
				},
			],
			"/": [
				{
					text: "Introduction",
					items: [
						{ text: "What is a result type?", link: "/what-is-a-result-type" },
						{ text: "Why this lib?", link: "/why" },
						{ text: "Getting started", link: "/getting-started" },
					],
				},
				{
					text: "Guide",
					items: [
						{ text: "A note on errors", link: "/a-note-on-errors" },
						{
							text: "Chaining vs. generator syntax",
							link: "/chaining-vs-generator-syntax",
						},
						{
							text: "Creating a result",
							link: "/creating-a-result",
						},
						{
							text: "Combining multiple results",
							link: "/combining-multiple-results",
						},
						{
							text: "Unwrapping a result",
							link: "/unwrapping-a-result",
						},
						{
							text: "Operations",
							items: [
								{
									text: "map",
									link: "/map",
								},
								{
									text: "mapError",
									link: "/map-error",
								},
								{
									text: "recover",
									link: "/recover",
								},
								{
									text: "onSuccess/onFailure",
									link: "/onsuccess-onfailure",
								},
							],
						},
						{
							text: "Async operations",
							link: "/async-operations",
						},
						{
							text: "Handling errors",
							link: "/handling-errors",
						},
					],
				},
				{
					text: "API Reference",
					collapsed: true,
					items: typedocSidebar.at(0)?.items,
				},
			],
		},

		socialLinks: [
			{ icon: "github", link: "https://github.com/everweij/typescript-result" },
		],
	},
	markdown: {
		codeTransformers: [
			transformerTwoslash({
				twoslashOptions: {
					compilerOptions: {
						strict: true,
						noImplicitReturns: true,
						paths: {
							"typescript-result": ["src/index.ts"],
						},
					},
				},
			}),
		],

		languages: ["ts", "js"],
	},
	vite: {
		ssr: {
			noExternal: ["monaco-editor"],
		},
	},
});
