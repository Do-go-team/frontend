import tsParser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
	globalIgnores(["dist", "src/routeTree.gen.ts"]),
	{
		files: ["**/*.{ts,tsx}"],
		languageOptions: {
			parser: tsParser,
		},
		extends: [reactHooks.configs.flat.recommended],
	},
]);
