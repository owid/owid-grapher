import { assert, expect, it, vi } from "vitest"

import { GrapherInterface } from "@ourworldindata/types"
import { mergeGrapherConfigs } from "@ourworldindata/utils"
import {
    defaultGrapherConfig,
    outdatedSchemaVersions,
} from "../defaultGrapherConfig"
import { migrateGrapherConfigToLatestVersion } from "./migrate"
import { runMigration } from "./migrations"
import { getSchemaVersion, isOutdatedVersion } from "./helpers"
import { MIGRATION_FIXTURES, PATCH_STACK_FIXTURES } from "./migrations.fixture"
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

it("returns a config unchanged if the schema field is missing", () => {
    const configWithoutSchema = { title: "Test" }
    expect(migrateGrapherConfigToLatestVersion(configWithoutSchema)).toEqual(
        configWithoutSchema
    )
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

for (const { name, before, after } of MIGRATION_FIXTURES) {
    const from = getSchemaVersion(before)
    const to = getSchemaVersion(after)
    it(`migrates ${from} to ${to}: ${name}`, () => {
        assert(isOutdatedVersion(from))
        const migrated = _.cloneDeep(before)
        runMigration(migrated, from)
        expect(migrated).toStrictEqual(after)
    })
}

it("pins every migration step with a fixture", () => {
    const pinned = new Set(
        MIGRATION_FIXTURES.map(({ before }) => getSchemaVersion(before))
    )
    const unpinned = outdatedSchemaVersions.filter(
        (version) => !pinned.has(version)
    )
    expect(unpinned).toEqual([])
})

for (const { name, patches } of PATCH_STACK_FIXTURES) {
    it(`migrates a patch stack the same in either order: ${name}`, () => {
        const stack = patches as GrapherInterface[]
        expect(
            migrateGrapherConfigToLatestVersion(mergeGrapherConfigs(...stack))
        ).toStrictEqual(
            mergeGrapherConfigs(
                ...stack.map(migrateGrapherConfigToLatestVersion)
            )
        )
    })
}
