import { describe, expect, it } from "vitest"
import { formatGrapherSchemaUrl } from "@ourworldindata/utils"
import { GrapherInterface } from "@ourworldindata/types"
import {
    type UntypedGrapherConfig,
    defaultGrapherConfig,
    latestSchemaVersion,
} from "@ourworldindata/grapher"
import {
    type GrapherConfigValidationIssue,
    assertValidGrapherConfig,
    formatGrapherConfigIssues,
    GrapherConfigValidationError,
    ingestGrapherConfig,
    tryIngestGrapherConfig,
} from "./grapherConfigValidation.js"

const latestSchemaUrl = defaultGrapherConfig.$schema
const foreignSchemaUrl = `https://example.org/schemas/grapher-schema.${latestSchemaVersion}.json`

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
                    message: `must have a $schema; expected ${latestSchemaUrl}`,
                },
            ],
        },
        {
            name: "a $schema that is not a string",
            config: { ...baseChartConfig, $schema: 123 },
            issues: [
                {
                    pointer: "/$schema",
                    message: `unknown schema version 123; expected ${latestSchemaUrl}`,
                },
            ],
        },
        {
            name: "an unknown schema version",
            config: {
                ...baseChartConfig,
                $schema: formatGrapherSchemaUrl("099"),
            },
            issues: [
                {
                    pointer: "/$schema",
                    message: `unknown schema version ${formatGrapherSchemaUrl("099")}; expected ${latestSchemaUrl}`,
                },
            ],
        },
        {
            name: "a schema hosted somewhere else",
            config: { ...baseChartConfig, $schema: foreignSchemaUrl },
            issues: [
                {
                    pointer: "/$schema",
                    message: `unknown schema version ${foreignSchemaUrl}; expected ${latestSchemaUrl}`,
                },
            ],
        },
        {
            name: "a config that fails to migrate",
            config: {
                ...baseChartConfig,
                $schema: formatGrapherSchemaUrl("010"),
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
            issues: [
                {
                    pointer: "/map/nope",
                    message: "must NOT have additional properties",
                },
            ],
        },
    ])("rejects $name", ({ config, issues }) => {
        expect(expectRejected(config)).toEqual(issues)
    })

    it.each([
        {
            name: "the latest version without a revision",
            $schema: formatGrapherSchemaUrl(latestSchemaVersion),
        },
        {
            name: "the latest version at any revision",
            $schema: formatGrapherSchemaUrl(latestSchemaVersion, 7),
        },
    ])(
        "accepts $name, stamping it with this build's revision",
        ({ $schema }) => {
            const config = expectAccepted({ ...baseChartConfig, $schema })
            expect(config.$schema).toBe(latestSchemaUrl)
        }
    )

    it("migrates an outdated config before validating it", () => {
        const config = expectAccepted({
            ...baseChartConfig,
            $schema: formatGrapherSchemaUrl("010"),
            dimensions: [
                { property: "y", variableId: 1, display: { yearIsDay: true } },
            ],
        })

        expect(config.$schema).toBe(latestSchemaUrl)
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
