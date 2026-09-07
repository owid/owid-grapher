import { describe, expect, it } from "vitest"
import { type AnyConfig, defaultGrapherConfig } from "@ourworldindata/grapher"
import {
    assertValidGrapherConfig,
    assertValidGrapherConfigs,
    GrapherConfigValidationError,
    ingestGrapherConfig,
    validateGrapherConfig,
} from "./grapherConfigValidation.js"

function schemaUrlForVersion(version: string): string {
    return `https://files.ourworldindata.org/schemas/grapher-schema.${version}.json`
}

const baseChartConfig: AnyConfig = {
    $schema: defaultGrapherConfig.$schema,
    dimensions: [{ property: "y", variableId: 1 }],
}

const { dimensions: _dimensions, ...basePatchConfig } = baseChartConfig

describe(validateGrapherConfig, () => {
    it("holds a patch to the patch schema and a chart to the chart schema", () => {
        expect(validateGrapherConfig(basePatchConfig, "patch")).toEqual([])

        const issues = validateGrapherConfig(basePatchConfig, "chart")
        expect(issues).toHaveLength(1)
        expect(issues[0].pointer).toBe("")
    })

    it("points at the unknown key itself, at the root and nested", () => {
        const atRoot = validateGrapherConfig(
            { ...baseChartConfig, hideLegend: true },
            "chart"
        )
        expect(atRoot.map((issue) => issue.pointer)).toEqual(["/hideLegend"])

        const nested = validateGrapherConfig(
            { ...baseChartConfig, map: { nope: 1 } },
            "chart"
        )
        expect(nested.map((issue) => issue.pointer)).toEqual(["/map/nope"])
    })
})

describe(ingestGrapherConfig, () => {
    it("migrates an outdated config before validating it", () => {
        const config = {
            ...baseChartConfig,
            $schema: schemaUrlForVersion("010"),
            dimensions: [
                { property: "y", variableId: 1, display: { yearIsDay: true } },
            ],
        }

        const migrated = ingestGrapherConfig(config, "chart")

        expect(migrated.$schema).toBe(defaultGrapherConfig.$schema)
        expect(migrated.dimensions?.[0].display).toStrictEqual({
            timeInterval: "day",
        })
    })

    it("rejects a config that is not an object", () => {
        const error = catchValidationError(() =>
            ingestGrapherConfig(null as unknown as AnyConfig, "chart")
        )

        expect(error.status).toBe(400)
        expect(error.issues).toEqual([
            { pointer: "", message: "must be object" },
        ])
    })

    it("rejects a config with no $schema", () => {
        const error = catchValidationError(() =>
            ingestGrapherConfig({ title: "Untitled" }, "chart")
        )

        expect(error.status).toBe(400)
        expect(error.issues).toEqual([
            {
                pointer: "/$schema",
                message: expect.stringContaining("must have a $schema"),
            },
        ])
    })

    it("rejects a schema version this code does not know", () => {
        const error = catchValidationError(() =>
            ingestGrapherConfig(
                { ...baseChartConfig, $schema: schemaUrlForVersion("099") },
                "chart"
            )
        )

        expect(error.status).toBe(400)
        expect(error.issues.map((issue) => issue.pointer)).toEqual(["/$schema"])
    })
})

describe(assertValidGrapherConfig, () => {
    it("does nothing when the config is valid", () => {
        expect(() =>
            assertValidGrapherConfig(baseChartConfig, "chart")
        ).not.toThrow()
    })

    it("throws on an invalid config", () => {
        const error = catchValidationError(() =>
            assertValidGrapherConfig(basePatchConfig, "chart")
        )
        expect(error.message).toBe(
            "Invalid grapher chart config:\n  (root): must have required property 'dimensions'"
        )
    })
})

describe(assertValidGrapherConfigs, () => {
    it("returns silently when every config is valid", () => {
        const configs = [
            { label: "chart 1", config: baseChartConfig },
            { label: "chart 2", config: baseChartConfig },
        ]
        expect(() => assertValidGrapherConfigs(configs, "chart")).not.toThrow()
    })

    it("throws once, naming every failing label with an N of M header", () => {
        const configs = [
            { label: "chart 1", config: baseChartConfig },
            { label: "chart 2", config: basePatchConfig },
            {
                label: "chart 3",
                config: { ...baseChartConfig, hideLegend: true },
            },
        ]
        const error = catchValidationError(() =>
            assertValidGrapherConfigs(configs, "chart")
        )

        expect(error.message.split("\n")[0]).toBe(
            "Invalid grapher chart config for 2 of 3 charts:"
        )
        expect(error.message).toContain(
            "  chart 2\n    (root): must have required property 'dimensions'"
        )
        expect(error.message).toContain(
            "  chart 3\n    /hideLegend: must NOT have additional properties"
        )
        expect(error.issues.map((issue) => issue.label)).toEqual([
            "chart 2",
            "chart 3",
        ])
    })
})

describe(GrapherConfigValidationError, () => {
    it("lists every issue in the message, naming the root pointer readably", () => {
        const error = new GrapherConfigValidationError("chart", [
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
