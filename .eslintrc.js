module.exports = {
    extends: [
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        project: "./**/tsconfig.json",
        ecmaVersion: 2018,
        sourceType: "module",
    },
    overrides: [
        {
            files: ["*.ts", "*.tsx"],
        },
    ],
    rules: {
        // These rules are only preliminary to ease the migration from tslint, many of them might make sense to have enabled!
        // "@typescript-eslint/camelcase": "warn",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-empty-function": "warn",
        "@typescript-eslint/no-empty-interface": "warn",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-for-in-array": "warn",
        "@typescript-eslint/no-inferrable-types": "warn",
        "@typescript-eslint/no-namespace": "warn",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-this-alias": "warn",
        "@typescript-eslint/no-unused-vars": "warn",
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/no-var-requires": "warn",
        "@typescript-eslint/restrict-plus-operands": "warn",
        "no-console": ["warn", { allow: ["warn", "error"] }],
        "no-var": "warn",
        "prefer-const": ["warn", { destructuring: "all" }],
        "react/display-name": "warn",
        "react/jsx-key": "warn",
        "react/jsx-no-target-blank": ["warn", { allowReferrer: true }],
        "react/no-render-return-value": "warn",
        "react/no-unescaped-entities": "off",
        "react/prop-types": "warn",
    },
    settings: {
        react: {
            version: "detect",
        },
    },
}
