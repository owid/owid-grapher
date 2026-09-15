import { describe, expect, it } from "vitest"
import { type AnyConfig, defaultGrapherConfig } from "@ourworldindata/grapher"
import {
    assertValidGrapherConfig,
    GrapherConfigValidationError,
    ingestGrapherConfig,
} from "./grapherConfigValidation.js"

function schemaUrlForVersion(version: string): string {
    return `https://files.ourworldindata.org/schemas/grapher-schema.${version}.json`
}

const baseChartConfig: AnyConfig = {
    $schema: defaultGrapherConfig.$schema,
    dimensions: [{ property: "y", variableId: 1 }],
}

const { dimensions: _dimensions, ...configWithoutDimensions } = baseChartConfig

const configWithEmptyDimensions: AnyConfig = {
    ...baseChartConfig,
    dimensions: [],
}

const configWithUnknownKey: AnyConfig = {
    ...baseChartConfig,
    hideLegend: true,
}

describe(ingestGrapherConfig, () => {
    it("migrates an outdated config before validating it", () => {
        const config = {
            ...baseChartConfig,
            $schema: schemaUrlForVersion("010"),
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

    it("rejects a config whose shape breaks its own migration", () => {
        const error = catchValidationError(() =>
            ingestGrapherConfig({
                ...baseChartConfig,
                $schema: schemaUrlForVersion("010"),
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
            ingestGrapherConfig(null as unknown as AnyConfig)
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
                $schema: schemaUrlForVersion("099"),
            })
        )

        expect(error.status).toBe(400)
        expect(error.issues.map((issue) => issue.pointer)).toEqual(["/$schema"])
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

function catchValidationError(run: () => void): GrapherConfigValidationError {
    try {
        run()
    } catch (error) {
        if (error instanceof GrapherConfigValidationError) return error
        throw error
    }
    throw new Error("expected a GrapherConfigValidationError")
}
