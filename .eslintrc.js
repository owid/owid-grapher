module.exports = {
    extends: [
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier/@typescript-eslint",
        "plugin:prettier/recommended"
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
    rules: {
        "@typescript-eslint/camelcase": "warn",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/interface-name-prefix": "warn",
        "@typescript-eslint/no-empty-function": "warn",
        "@typescript-eslint/no-empty-interface": "warn",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/no-namespace": "warn",
        "@typescript-eslint/no-this-alias": "warn",
        "@typescript-eslint/no-use-before-define": "warn",
        "@typescript-eslint/no-var-requires": "warn",
        "no-var": "warn",
        "prefer-const": ["warn", { destructuring: "all" }],
        "react/display-name": "warn",
        "react/jsx-key": "warn",
        "react/jsx-no-target-blank": "warn",
        "react/no-render-return-value": "warn",
        "react/no-unescaped-entities": "warn",
        "react/prop-types": "warn"
    },
    settings: {
        react: {
            version: "detect"
        }
    }
}
