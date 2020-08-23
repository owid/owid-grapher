module.exports = {
    extends: [
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
        "prettier/react",
        "prettier/@typescript-eslint",
        "plugin:import/recommended",
        "plugin:import/typescript"
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaFeatures: {
            jsx: true
        },
        project: "./tsconfig.json",
        ecmaVersion: 2018,
        sourceType: "module"
    },
    overrides: [
        {
            files: ["*.ts", "*.tsx"]
        }
    ],
    rules: {
        // These rules are only preliminary to ease the migration from tslint, many of them might make sense to have enabled!
        "@typescript-eslint/camelcase": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-empty-interface": "warn",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-for-in-array": "warn",
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-this-alias": "off",
        "@typescript-eslint/no-unused-vars": "warn",
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/restrict-plus-operands": "warn",
        "no-console": ["warn", { allow: ["warn", "error"] }],
        "no-var": "off",
        "prefer-const": ["warn", { destructuring: "all" }],
        "react/display-name": "off",
        "react/jsx-key": "warn",
        "react/jsx-no-target-blank": "off",
        "react/no-render-return-value": "off",
        "react/no-unescaped-entities": "off",
        "react/prop-types": "off"
    },
    settings: {
        react: {
            version: "detect"
        },
        "import/resolver": "webpack"
    }
}
