#! /usr/bin/env jest

import { defaultGrapherConfig } from "../defaultGrapherConfig"
import { migrateGrapherConfigToLatestVersion } from "./migrate"

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

it("throws if the schema field is invalid", () => {
    expect(() =>
        migrateGrapherConfigToLatestVersion({
            $schema: "invalid",
        })
    ).toThrow()
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
