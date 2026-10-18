import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import a11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
export default ts.config(
    { ignores: [".next/**", "next-env.d.ts"] },
    js.configs.recommended,
    ...ts.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: { globals: { ...globals.browser, ...globals.node } },
        plugins: { "react-hooks": hooks, react, "jsx-a11y": a11y },
        settings: { react: { version: "detect" } },
        rules: {
            ...hooks.configs.recommended.rules,
            ...react.configs["jsx-runtime"].rules,
            ...a11y.configs.recommended.rules,
            "@typescript-eslint/no-unused-vars": "warn",
        },
    },
);
