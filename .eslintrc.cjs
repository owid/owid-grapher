// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path")

module.exports = {
    extends: [
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:import/recommended",
        "plugin:import/typescript",
        "prettier",
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        project: path.join(__dirname, "tsconfig.eslint.json"),
        ecmaVersion: "latest",
    },
    overrides: [
        {
            files: ["*.ts", "*.tsx"],
        },
    ],
    rules: {
        // These rules are only preliminary to ease the migration from tslint, many of them might make sense to have enabled!
        // use `export type` whenever applicable
        "@typescript-eslint/consistent-type-exports": [
            "warn",
            { fixMixedExportsWithInlineTypeSpecifier: true },
        ],
        "@typescript-eslint/explicit-function-return-type": "off", // This rule is enabled on a folder by folder basis and should be enabled project wide soon
        "@typescript-eslint/explicit-module-boundary-types": "off", // This rule is enabled on a folder by folder basis and should be enabled project wide soon
        "@typescript-eslint/no-empty-function": "warn",
        "@typescript-eslint/no-empty-interface": "warn",
        "@typescript-eslint/no-explicit-any": "off", // TODO: enable this rule
        "@typescript-eslint/no-for-in-array": "warn",
        "@typescript-eslint/no-non-null-assertion": "off", // TODO: enable this rule
        "@typescript-eslint/no-unused-vars": [
            "warn",
            { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/prefer-for-of": "warn",
        "@typescript-eslint/restrict-plus-operands": "warn",
        eqeqeq: "warn",
        // Turn off import rules covered by typescript-eslint.
        // https://typescript-eslint.io/troubleshooting/performance-troubleshooting/#eslint-plugin-import
        "import/named": "off",
        "import/namespace": "off",
        "import/default": "off",
        "import/no-named-as-default-member": "off",
        "import/no-unresolved": "off",
        "no-console": ["warn", { allow: ["warn", "error"] }],
        "prefer-const": ["warn", { destructuring: "all" }],
        "react/display-name": "warn",
        "react/jsx-key": "warn",
        "react/jsx-no-target-blank": ["warn", { allowReferrer: true }],
        "react/no-render-return-value": "warn",
        "react/no-unescaped-entities": ["warn", { forbid: [">", "}"] }],
        "react/prop-types": "warn",
        "@typescript-eslint/no-floating-promises": "error",
        "no-constant-binary-expression": "error",
    },
    settings: {
        "import/resolver": {
            typescript: true,
            node: true,
        },
        react: {
            version: "detect",
        },
    },
}
