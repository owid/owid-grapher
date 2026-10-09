import { describe, expect, it } from "vitest"
import { GrapherInterface } from "@ourworldindata/types"
import {
    type UntypedGrapherConfig,
    defaultGrapherConfig,
} from "@ourworldindata/grapher"
import {
    type GrapherConfigValidationIssue,
    assertValidGrapherConfig,
    formatGrapherConfigIssues,
    GrapherConfigValidationError,
    ingestGrapherConfig,
    tryIngestGrapherConfig,
} from "./grapherConfigValidation.js"

function schemaUrlForVersion(version: string): string {
    return `https://files.ourworldindata.org/schemas/grapher-schema.${version}.json`
}

const baseChartConfig: UntypedGrapherConfig = {
    $schema: defaultGrapherConfig.$schema,
    dimensions: [{ property: "y", variableId: 1 }],
}

const configWithUnknownKey: UntypedGrapherConfig = {
    ...baseChartConfig,
    hideLegend: true,
}

describe(tryIngestGrapherConfig, () => {
    it.each<{
        name: string
        config: unknown
        issues: GrapherConfigValidationIssue[]
    }>([
        {
            name: "null",
            config: null,
            issues: [{ pointer: "", message: "must be object" }],
        },
        {
            name: "a string",
            config: "not a config",
            issues: [{ pointer: "", message: "must be object" }],
        },
        {
            name: "an array",
            config: [],
            issues: [{ pointer: "", message: "must be object" }],
        },
        {
            name: "a config with no $schema",
            config: { title: "Untitled" },
            issues: [
                {
                    pointer: "/$schema",
                    message: expect.stringContaining("must have a $schema"),
                },
            ],
        },
        {
            name: "a $schema that is not a string",
            config: { ...baseChartConfig, $schema: 123 },
            issues: [{ pointer: "/$schema", message: expect.any(String) }],
        },
        {
            name: "an unknown schema version",
            config: {
                ...baseChartConfig,
                $schema: schemaUrlForVersion("099"),
            },
            issues: [{ pointer: "/$schema", message: expect.any(String) }],
        },
        {
            name: "a config that fails to migrate",
            config: {
                ...baseChartConfig,
                $schema: schemaUrlForVersion("010"),
                dimensions: 123,
            },
            issues: [
                {
                    pointer: "",
                    message: expect.stringContaining(
                        "could not be migrated from schema version 010"
                    ),
                },
            ],
        },
        {
            name: "an unknown key at the root",
            config: configWithUnknownKey,
            issues: [
                {
                    pointer: "/hideLegend",
                    message: "must NOT have additional properties",
                },
            ],
        },
        {
            name: "an unknown nested key",
            config: { ...baseChartConfig, map: { nope: 1 } },
            issues: [{ pointer: "/map/nope", message: expect.any(String) }],
        },
    ])("rejects $name", ({ config, issues }) => {
        expect(expectRejected(config)).toEqual(issues)
    })

    it("accepts a config at the latest version", () => {
        const config = expectAccepted(baseChartConfig)
        expect(config.$schema).toBe(defaultGrapherConfig.$schema)
    })

    it("migrates an outdated config before validating it", () => {
        const config = expectAccepted({
            ...baseChartConfig,
            $schema: schemaUrlForVersion("010"),
            dimensions: [
                { property: "y", variableId: 1, display: { yearIsDay: true } },
            ],
        })

        expect(config.$schema).toBe(defaultGrapherConfig.$schema)
        expect(config.dimensions?.[0].display).toStrictEqual({
            timeInterval: "day",
        })
    })
})

describe(ingestGrapherConfig, () => {
    it("throws the rejection issues as a 400 error", () => {
        const issues = expectRejected(configWithUnknownKey)

        const error = catchValidationError(() =>
            ingestGrapherConfig(configWithUnknownKey)
        )

        expect(error.status).toBe(400)
        expect(error.issues).toEqual(issues)
    })
})

describe(assertValidGrapherConfig, () => {
    it("accepts a config without dimensions", () => {
        const { dimensions: _dimensions, ...configWithoutDimensions } =
            baseChartConfig

        expect(() => assertValidGrapherConfig(baseChartConfig)).not.toThrow()
        expect(() =>
            assertValidGrapherConfig(configWithoutDimensions)
        ).not.toThrow()
        expect(() =>
            assertValidGrapherConfig({ ...baseChartConfig, dimensions: [] })
        ).not.toThrow()
    })

    it("throws an error that lists each issue", () => {
        const error = catchValidationError(() =>
            assertValidGrapherConfig(configWithUnknownKey)
        )

        expect(error.issues.map((issue) => issue.pointer)).toEqual([
            "/hideLegend",
        ])
        expect(error.message).toBe(
            "Invalid grapher config:\n  /hideLegend: must NOT have additional properties"
        )
    })
})

describe(formatGrapherConfigIssues, () => {
    it("writes one line per issue, with (root) for the empty pointer", () => {
        const message = formatGrapherConfigIssues([
            {
                pointer: "",
                message: "must have required property 'dimensions'",
            },
            {
                pointer: "/hideLegend",
                message: "must NOT have additional properties",
            },
        ])

        expect(message).toBe(
            [
                "Invalid grapher config:",
                "  (root): must have required property 'dimensions'",
                "  /hideLegend: must NOT have additional properties",
            ].join("\n")
        )
    })
})

function expectAccepted(config: unknown): GrapherInterface {
    const ingestResult = tryIngestGrapherConfig(config)
    if (!ingestResult.isValid)
        throw new Error(
            `expected a valid config, got ${formatGrapherConfigIssues(ingestResult.issues)}`
        )
    return ingestResult.config
}

function expectRejected(config: unknown): GrapherConfigValidationIssue[] {
    const ingestResult = tryIngestGrapherConfig(config)
    if (ingestResult.isValid) throw new Error("expected an invalid config")
    return ingestResult.issues
}

function catchValidationError(run: () => void): GrapherConfigValidationError {
    try {
        run()
    } catch (error) {
        if (error instanceof GrapherConfigValidationError) return error
        throw error
    }
    throw new Error("expected a GrapherConfigValidationError")
}
