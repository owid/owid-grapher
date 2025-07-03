import { expect, it, vi } from "vitest"

import { defaultGrapherConfig } from "../defaultGrapherConfig"
import { migrateGrapherConfigToLatestVersion } from "./migrate"
import { migrateFrom006To007, migrateFrom007To008 } from "./migrations"
import { AnyConfigWithValidSchema } from "./helpers"
import * as _ from "lodash-es"

it("returns a valid config as is", () => {
    const validConfig = {
        $schema: defaultGrapherConfig.$schema,
        title: "Test",
    }
    expect(migrateGrapherConfigToLatestVersion(validConfig)).toEqual(
        validConfig
    )
})

it("throws if the schema field is missing", () => {
    expect(() => migrateGrapherConfigToLatestVersion({})).toThrow()
})

it("warns if the schema field is invalid", () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(_.noop)

    const invalidConfig = {
        $schema: "invalid",
    }
    expect(migrateGrapherConfigToLatestVersion(invalidConfig)).toEqual(
        invalidConfig
    )

    expect(consoleWarnSpy).toHaveBeenCalled()
    consoleWarnSpy.mockRestore()
})

it("runs multiple migrations if necessary", () => {
    const outdatedConfig = {
        $schema:
            "https://files.ourworldindata.org/schemas/grapher-schema.003.json",
        data: { availableEntities: [] }, // removed in v4
        hideLinesOutsideTolerance: true, // removed in v5
    }
    const validConfig = migrateGrapherConfigToLatestVersion(outdatedConfig)
    expect(validConfig).not.toHaveProperty("data")
    expect(validConfig).not.toHaveProperty("hideLinesOutsideTolerance")
})

it("doesn't mutate the given config", () => {
    const outdatedConfig = {
        $schema:
            "https://files.ourworldindata.org/schemas/grapher-schema.004.json",
        hideLinesOutsideTolerance: true,
    }
    const validConfig = migrateGrapherConfigToLatestVersion(outdatedConfig)
    expect(validConfig).not.toHaveProperty("hideLinesOutsideTolerance")
    expect(outdatedConfig).toEqual({
        $schema:
            "https://files.ourworldindata.org/schemas/grapher-schema.004.json",
        hideLinesOutsideTolerance: true,
    })
})

// Bit of a funky test that ensures the migration function terminates.
// Not really necessary since the tests above also fail when they encounter
// an infinite loop, but this one provides context on what's going wrong and gives
// guidance on what to do about it.
it("terminates", () => {
    const outdatedConfig = {
        $schema:
            "https://files.ourworldindata.org/schemas/grapher-schema.001.json",
    }

    try {
        migrateGrapherConfigToLatestVersion(outdatedConfig)
    } catch (error) {
        if (error instanceof RangeError) {
            expect("should terminate, but doesn't").toBe(
                "check if the config's $schema field is updated to the next version in every migration function"
            )
        }
    }
})

it("migrates version 006 to 007 correctly", () => {
    const config: AnyConfigWithValidSchema = {
        $schema:
            "https://files.ourworldindata.org/schemas/grapher-schema.006.json",
        hasMapTab: true,
        map: {
            projection: "Europe",
            time: 2000,
        },
    }

    // check that the $schema field is updated
    expect(migrateFrom006To007(config)).toHaveProperty(
        "$schema",
        "https://files.ourworldindata.org/schemas/grapher-schema.007.json"
    )

    // check that the map.projection field is removed
    expect(migrateFrom006To007(config)).not.toHaveProperty("map.projection")

    // check that the map.region field is added
    expect(migrateFrom006To007(config)).toHaveProperty("map.region", "Europe")
})

it("migrates version 007 to 008 correctly", () => {
    const config: AnyConfigWithValidSchema = {
        $schema:
            "https://files.ourworldindata.org/schemas/grapher-schema.007.json",
        hasMapTab: true,
        map: {
            colorScale: {
                customNumericMinValue: 0,
                customNumericValues: [1, 2, 3],
            },
        },
    }

    const migrated = migrateFrom007To008(config)

    // check that the $schema field is updated
    expect(migrated).toHaveProperty(
        "$schema",
        "https://files.ourworldindata.org/schemas/grapher-schema.008.json"
    )

    expect(migrated).not.toHaveProperty("map.colorScale.customNumericMinValue")
    expect(migrated).toHaveProperty(
        "map.colorScale.customNumericValues",
        [0, 1, 2, 3]
    )
})
