import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
	{
		ignores: ["dist/**", "node_modules/**"]
	},
	{
		files: ["src/**/*.{ts,tsx}"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: "./tsconfig.json",
				tsconfigRootDir: import.meta.dirname,
				sourceType: "module"
			}
		},
		plugins: {
			"@typescript-eslint": tseslint
		},
		rules: {
			"@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
		}
	}
];
