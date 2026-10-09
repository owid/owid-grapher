import { expect, it } from "vitest"

import { defaultGrapherConfig } from "@ourworldindata/grapher"

import { parseChartConfig } from "./ChartConfigs.js"

const outdatedConfig = {
    $schema: "https://files.ourworldindata.org/schemas/grapher-schema.010.json",
    dimensions: [
        { variableId: 1, property: "y", display: { yearIsDay: true } },
    ],
}

it("returns a config already at the latest schema unchanged", () => {
    const config = {
        $schema: defaultGrapherConfig.$schema,
        title: "Test",
    }
    expect(parseChartConfig(JSON.stringify(config))).toEqual(config)
})

it("migrates an outdated config to the latest schema", () => {
    const migrated = parseChartConfig(JSON.stringify(outdatedConfig))
    expect(migrated.$schema).toEqual(defaultGrapherConfig.$schema)
    expect(migrated.dimensions?.[0].display?.timeInterval).toEqual("day")
    expect(migrated.dimensions?.[0].display).not.toHaveProperty("yearIsDay")
})

it("leaves an outdated config as stored when skipMigration is set", () => {
    const parsed = parseChartConfig(JSON.stringify(outdatedConfig), {
        skipMigration: true,
    })
    expect(parsed).toEqual(outdatedConfig)
})

it("returns a config without a $schema unchanged", () => {
    const config = { title: "Test" }
    expect(parseChartConfig(JSON.stringify(config))).toEqual(config)
})

it("returns the config unchanged if migrating it throws", () => {
    // Migrating from 010 loops over dimensions, so an object there throws
    const configWithNonArrayDimensions = {
        $schema:
            "https://files.ourworldindata.org/schemas/grapher-schema.010.json",
        dimensions: { variableId: 1, property: "y" },
    }
    expect(
        parseChartConfig(JSON.stringify(configWithNonArrayDimensions))
    ).toEqual(configWithNonArrayDimensions)
})
