import TwoslashFloatingVue from "@shikijs/vitepress-twoslash/client";
import type { EnhanceAppContext } from "vitepress";
import Theme from "vitepress/theme";

import "./custom.css";
import "@shikijs/vitepress-twoslash/style.css";

export default {
	extends: Theme,
	enhanceApp({ app }: EnhanceAppContext) {
		app.use(TwoslashFloatingVue);
	},
};
