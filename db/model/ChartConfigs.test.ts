import { expect, it } from "vitest"

import { formatGrapherSchemaUrl } from "@ourworldindata/utils"
import {
    defaultGrapherConfig,
    latestSchemaVersion,
} from "@ourworldindata/grapher"

import { parseAndMigrateChartConfig } from "./ChartConfigs.js"

const latestSchemaUrlWithoutRevision =
    formatGrapherSchemaUrl(latestSchemaVersion)
const outdatedSchemaUrl = formatGrapherSchemaUrl("010")

const outdatedConfig = {
    $schema: outdatedSchemaUrl,
    dimensions: [
        { variableId: 1, property: "y", display: { yearIsDay: true } },
    ],
}

it("returns a config already at the latest schema unchanged", () => {
    const config = {
        $schema: defaultGrapherConfig.$schema,
        title: "Test",
    }
    expect(parseAndMigrateChartConfig(JSON.stringify(config))).toEqual(config)
})

it("migrates an outdated config to the latest schema", () => {
    const migrated = parseAndMigrateChartConfig(JSON.stringify(outdatedConfig))
    expect(migrated.$schema).toEqual(latestSchemaUrlWithoutRevision)
    expect(migrated.dimensions?.[0].display?.timeInterval).toEqual("day")
    expect(migrated.dimensions?.[0].display).not.toHaveProperty("yearIsDay")
})

it("returns a config without a $schema unchanged", () => {
    const config = { title: "Test" }
    expect(parseAndMigrateChartConfig(JSON.stringify(config))).toEqual(config)
})

it("returns the config unchanged if migrating it throws", () => {
    const configWithNonArrayDimensions = {
        $schema: outdatedSchemaUrl,
        dimensions: { variableId: 1, property: "y" },
    }
    expect(
        parseAndMigrateChartConfig(JSON.stringify(configWithNonArrayDimensions))
    ).toEqual(configWithNonArrayDimensions)
})
