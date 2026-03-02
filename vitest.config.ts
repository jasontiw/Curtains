import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	test: {
		// Test environment for browser-like behavior
		environment: "jsdom",
		// Where to look for test files
		include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
		// Coverage configuration
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["src/**/*.ts", "src/**/*.tsx"],
			exclude: ["src/main.tsx", "src/vite-env.d.ts", "**/*.test.ts"],
		},
		// Global test setup
		globals: true,
		// Test reporter
		reporters: ["verbose"],
		// Watch mode patterns
		watchExclude: ["**/node_modules/**", "**/dist/**"],
	},
});
