// @ts-check

import eslint from "@eslint/js"
// TODO: Remove this when the lib adds type declarations.
// @ts-ignore
import importPlugin from "eslint-plugin-import"
import prettier from "eslint-config-prettier"
import react from "eslint-plugin-react"
// TODO: Remove this when the lib adds type declarations.
// https://github.com/facebook/react/issues/30119
// @ts-ignore
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    importPlugin.flatConfigs.recommended,
    importPlugin.flatConfigs.typescript,
    // @ts-ignore
    react.configs.flat.recommended,
    // @ts-ignore
    react.configs.flat["jsx-runtime"],
    {
        files: [
            // TODO: Apply to all React files when we move off class components,
            // since they are not supported.
            "adminSiteClient/**/*.tsx",
            "explorerAdminClient/**/*.tsx",
            "packages/@ourworldindata/components/src/**/*.tsx",
            "site/**/*.tsx",
        ],
        plugins: {
            "react-refresh": reactRefresh,
        },
        rules: {
            "react-refresh/only-export-components": [
                "error",
                { allowConstantExport: true },
            ],
        },
    },
    {
        plugins: {
            // They don't have a compatible flat config at the moment. Update to
            // a flat one when they do.
            "react-hooks": reactHooks,
        },
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.eslint.json",
            },
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
        rules: {
            ...reactHooks.configs.recommended.rules,
            "@typescript-eslint/consistent-type-exports": [
                "warn",
                {
                    fixMixedExportsWithInlineTypeSpecifier: true,
                },
            ],

            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-empty-function": "warn",
            "@typescript-eslint/no-empty-interface": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-for-in-array": "warn",
            "@typescript-eslint/no-non-null-assertion": "off",

            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    varsIgnorePattern: "^_",
                    argsIgnorePattern: "^_",
                },
            ],

            "@typescript-eslint/prefer-for-of": "warn",
            "@typescript-eslint/restrict-plus-operands": "warn",
            eqeqeq: "warn",
            "import/named": "off",
            "import/namespace": "off",
            "import/default": "off",
            "import/no-named-as-default-member": "off",
            "import/no-unresolved": "off",

            "no-console": [
                "warn",
                {
                    allow: ["warn", "error"],
                },
            ],

            "prefer-const": [
                "warn",
                {
                    destructuring: "all",
                },
            ],

            "react/display-name": "warn",
            "react/jsx-key": "warn",

            "react/jsx-no-target-blank": [
                "warn",
                {
                    allowReferrer: true,
                },
            ],

            "react/no-render-return-value": "warn",

            "react/no-unescaped-entities": [
                "warn",
                {
                    forbid: [">", "}"],
                },
            ],

            "react/prop-types": "warn",
            "@typescript-eslint/no-floating-promises": "error",
            "no-constant-binary-expression": "error",
        },
    },
    {
        files: [
            "adminSiteClient/**/*",
            "adminSiteServer/**/*",
            "baker/**/*",
            "db/**/*",
            "devTools/**/*",
            "functions/**/*",
            "explorerAdminClient/**/*",
            "explorerAdminServer/**/*",
            "settings/**/*",
        ],
        rules: {
            "no-console": "off",
        },
    },
    {
        files: [
            "db/**/*",
            "packages/@ourworldindata/core-table/**/*",
            "packages/@ourworldindata/grapher/src/axis/**/*",
            "packages/@ourworldindata/grapher/src/barCharts/**/*",
            "packages/@ourworldindata/grapher/src/bodyDiv/**/*",
            "packages/@ourworldindata/grapher/src/captionedChart/**/*",
            "packages/@ourworldindata/grapher/src/chart/**/*",
            "packages/@ourworldindata/grapher/src/color/**/*",
            "packages/@ourworldindata/grapher/src/controls/**/*",
            "packages/@ourworldindata/grapher/src/core/**/*",
            "packages/@ourworldindata/grapher/src/dataTable/**/*",
            "packages/@ourworldindata/grapher/src/facetChart/**/*",
            "packages/@ourworldindata/grapher/src/footer/**/*",
            "packages/@ourworldindata/grapher/src/header/**/*",
            "packages/@ourworldindata/grapher/src/lineCharts/**/*",
            "packages/@ourworldindata/grapher/src/loadingIndicator/**/*",
            "packages/@ourworldindata/grapher/src/mapCharts/**/*",
            "packages/@ourworldindata/grapher/src/noDataModal/**/*",
            "packages/@ourworldindata/grapher/src/scatterCharts/**/*",
            "packages/@ourworldindata/grapher/src/selection/**/*",
            "packages/@ourworldindata/grapher/src/stackedCharts/**/*",
            "packages/@ourworldindata/grapher/src/timeline/**/*",
            "packages/@ourworldindata/grapher/src/tooltip/**/*",
            "packages/@ourworldindata/grapher/src/verticalColorLegend/**/*",
            "packages/@ourworldindata/utils/**/*",
            "packages/@ourworldindata/utils/src/persistable/**/*",
            "settings/**/*",
        ],
        rules: {
            "@typescript-eslint/explicit-function-return-type": "warn",
            "@typescript-eslint/explicit-module-boundary-types": "warn",
        },
    },
    prettier,
    {
        ignores: [
            "**/.*",
            "**/*.cjs",
            "**/*.js",
            "**/dist/",
            "**/jest.config.js",
            "**/knexfile.ts",
            "bakedSite/**/*",
            "coverage/**/*",
            "devtools/**/*",
            "eslint.config.mjs",
            "itsJustJavascript/**/*",
            "localBake/**/*",
            "packages/@ourworldindata/*/dist/",
            "packages/@ourworldindata/grapher/tsup.config.bundled_*.mjs",
            "vite.*.mjs",
        ],
    }
)
