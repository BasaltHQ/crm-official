import nextConfig from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
const config = [
    // Global ignores
    {
        ignores: [".next/**", "node_modules/**", "public/connect/connect-streams.js"],
    },
    ...nextConfig,
    // TypeScript plugin setup
    {
        plugins: {
            "@typescript-eslint": tseslint.plugin,
        },
    },
    // Overrides
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
        rules: {
            "@next/next/no-img-element": "off",
            "react/no-unescaped-entities": "off",
            "@next/next/no-assign-module-variable": "off",
        },
    },
    // React Hooks specific overrides - ensuring scoped to where plugin exists
    {
        files: ["**/*.ts", "**/*.tsx"],
        rules: {
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/incompatible-library": "off",
            "react-hooks/preserve-manual-memoization": "off",
            "react-hooks/purity": "error",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/immutability": "error"
        }
    }
];

export default config;
