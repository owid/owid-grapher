import { describe, expect, it } from "vitest"
import { formatGrapherSchemaUrl } from "@ourworldindata/utils"
import {
    type UntypedGrapherConfig,
    defaultGrapherConfig,
    latestSchemaVersion,
} from "@ourworldindata/grapher"
import {
    assertValidGrapherConfig,
    formatGrapherConfigIssues,
    GrapherConfigValidationError,
    ingestGrapherConfig,
    tryIngestGrapherConfig,
} from "./grapherConfigValidation.js"

const baseChartConfig: UntypedGrapherConfig = {
    $schema: defaultGrapherConfig.$schema,
    dimensions: [{ property: "y", variableId: 1 }],
}

const { dimensions: _dimensions, ...configWithoutDimensions } = baseChartConfig

const configWithEmptyDimensions: UntypedGrapherConfig = {
    ...baseChartConfig,
    dimensions: [],
}

const configWithUnknownKey: UntypedGrapherConfig = {
    ...baseChartConfig,
    hideLegend: true,
}

describe(ingestGrapherConfig, () => {
    it("migrates an outdated config before validating it", () => {
        const config = {
            ...baseChartConfig,
            $schema: formatGrapherSchemaUrl("010"),
            dimensions: [
                { property: "y", variableId: 1, display: { yearIsDay: true } },
            ],
        }

        const migrated = ingestGrapherConfig(config)

        expect(migrated.$schema).toBe(defaultGrapherConfig.$schema)
        expect(migrated.dimensions?.[0].display).toStrictEqual({
            timeInterval: "day",
        })
    })

    it("stamps a config with the schema document it was written against", () => {
        for (const $schema of [
            formatGrapherSchemaUrl(latestSchemaVersion),
            formatGrapherSchemaUrl(latestSchemaVersion, 7),
        ]) {
            const ingested = ingestGrapherConfig({
                ...baseChartConfig,
                $schema,
            })
            expect(ingested.$schema).toBe(defaultGrapherConfig.$schema)
        }
    })

    it("rejects a config whose shape breaks its own migration", () => {
        const error = catchValidationError(() =>
            ingestGrapherConfig({
                ...baseChartConfig,
                $schema: formatGrapherSchemaUrl("010"),
                dimensions: 123,
            })
        )

        expect(error.status).toBe(400)
        expect(error.issues.map((issue) => issue.pointer)).toEqual([""])
        expect(error.issues[0].message).toContain(
            "could not be migrated from schema version 010"
        )
    })

    it("rejects a config that is not an object", () => {
        const error = catchValidationError(() =>
            ingestGrapherConfig(null as unknown as UntypedGrapherConfig)
        )

        expect(error.status).toBe(400)
        expect(error.issues).toEqual([
            { pointer: "", message: "must be object" },
        ])
    })

    it("rejects a config with no $schema", () => {
        const error = catchValidationError(() =>
            ingestGrapherConfig({ title: "Untitled" })
        )

        expect(error.status).toBe(400)
        expect(error.issues).toEqual([
            {
                pointer: "/$schema",
                message: expect.stringContaining("must have a $schema"),
            },
        ])
    })

    it("rejects a $schema that is not a string", () => {
        const error = catchValidationError(() =>
            ingestGrapherConfig({ ...baseChartConfig, $schema: 123 })
        )

        expect(error.status).toBe(400)
        expect(error.issues.map((issue) => issue.pointer)).toEqual(["/$schema"])
    })

    it("rejects a schema version this code does not know", () => {
        const error = catchValidationError(() =>
            ingestGrapherConfig({
                ...baseChartConfig,
                $schema: formatGrapherSchemaUrl("099"),
            })
        )

        expect(error.status).toBe(400)
        expect(error.issues.map((issue) => issue.pointer)).toEqual(["/$schema"])
    })

    it("throws the exact issues tryIngestGrapherConfig returns, pinning the single validation path", () => {
        const invalidConfig = configWithUnknownKey

        const ingestResult = tryIngestGrapherConfig(invalidConfig)
        if (ingestResult.isValid) throw new Error("expected an invalid config")

        const error = catchValidationError(() =>
            ingestGrapherConfig(invalidConfig)
        )
        expect(error.issues).toEqual(ingestResult.issues)
    })
})

describe(tryIngestGrapherConfig, () => {
    it("returns the migrated config, restamped with the latest schema, when it is valid", () => {
        const ingestResult = tryIngestGrapherConfig(baseChartConfig)
        if (!ingestResult.isValid) throw new Error("expected a valid config")
        expect(ingestResult.config.$schema).toBe(defaultGrapherConfig.$schema)
    })

    it("migrates an outdated config and reports it valid", () => {
        const config = {
            ...baseChartConfig,
            $schema: formatGrapherSchemaUrl("010"),
            dimensions: [
                { property: "y", variableId: 1, display: { yearIsDay: true } },
            ],
        }

        const ingestResult = tryIngestGrapherConfig(config)

        if (!ingestResult.isValid) throw new Error("expected a valid config")
        expect(ingestResult.config.$schema).toBe(defaultGrapherConfig.$schema)
        expect(ingestResult.config.dimensions?.[0].display).toStrictEqual({
            timeInterval: "day",
        })
    })

    it("returns a single issue at /hideLegend for a config with an unknown key", () => {
        const ingestResult = tryIngestGrapherConfig(configWithUnknownKey)
        if (ingestResult.isValid) throw new Error("expected an invalid config")
        expect(ingestResult.issues).toEqual([
            {
                pointer: "/hideLegend",
                message: "must NOT have additional properties",
            },
        ])
    })

    it("returns a single issue at /$schema when it is absent or names an unknown version", () => {
        const missingSchema = tryIngestGrapherConfig({ title: "Untitled" })
        if (missingSchema.isValid) throw new Error("expected an invalid config")
        expect(missingSchema.issues).toEqual([
            {
                pointer: "/$schema",
                message: expect.stringContaining("must have a $schema"),
            },
        ])

        const unknownSchema = tryIngestGrapherConfig({
            ...baseChartConfig,
            $schema: formatGrapherSchemaUrl("099"),
        })
        if (unknownSchema.isValid) throw new Error("expected an invalid config")
        expect(unknownSchema.issues.map((issue) => issue.pointer)).toEqual([
            "/$schema",
        ])
    })

    it("returns a single issue at the root pointer for null, a string, and an array", () => {
        for (const config of [null, "not a config", []]) {
            const ingestResult = tryIngestGrapherConfig(config)
            if (ingestResult.isValid)
                throw new Error("expected an invalid config")
            expect(ingestResult.issues).toEqual([
                { pointer: "", message: "must be object" },
            ])
        }
    })
})

describe(assertValidGrapherConfig, () => {
    it("does nothing when the config is valid", () => {
        expect(() => assertValidGrapherConfig(baseChartConfig)).not.toThrow()
    })

    it("holds a config that plots nothing, with no dimensions or an empty array", () => {
        expect(() =>
            assertValidGrapherConfig(configWithoutDimensions)
        ).not.toThrow()
        expect(() =>
            assertValidGrapherConfig(configWithEmptyDimensions)
        ).not.toThrow()
    })

    it("points at the unknown key itself, at the root and nested", () => {
        const atRoot = catchValidationError(() =>
            assertValidGrapherConfig(configWithUnknownKey)
        )
        expect(atRoot.issues.map((issue) => issue.pointer)).toEqual([
            "/hideLegend",
        ])

        const nested = catchValidationError(() =>
            assertValidGrapherConfig({ ...baseChartConfig, map: { nope: 1 } })
        )
        expect(nested.issues.map((issue) => issue.pointer)).toEqual([
            "/map/nope",
        ])
    })

    it("throws on an invalid config", () => {
        const error = catchValidationError(() =>
            assertValidGrapherConfig(configWithUnknownKey)
        )
        expect(error.message).toBe(
            "Invalid grapher config:\n  /hideLegend: must NOT have additional properties"
        )
    })
})

describe(GrapherConfigValidationError, () => {
    it("lists every issue in the message, naming the root pointer readably", () => {
        const error = new GrapherConfigValidationError([
            {
                pointer: "",
                message: "must have required property 'dimensions'",
            },
            {
                pointer: "/hideLegend",
                message: "must NOT have additional properties",
            },
        ])

        expect(error.message).toContain(
            "(root): must have required property 'dimensions'"
        )
        expect(error.message).toContain(
            "/hideLegend: must NOT have additional properties"
        )
    })
})

describe(formatGrapherConfigIssues, () => {
    it("renders (root) for the empty pointer, and one indented line per issue", () => {
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

function catchValidationError(run: () => void): GrapherConfigValidationError {
    try {
        run()
    } catch (error) {
        if (error instanceof GrapherConfigValidationError) return error
        throw error
    }
    throw new Error("expected a GrapherConfigValidationError")
}
