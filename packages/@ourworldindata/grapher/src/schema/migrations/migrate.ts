import { GrapherInterface } from "@ourworldindata/types"
import { cloneDeep } from "@ourworldindata/utils"

import { defaultGrapherConfig } from "../defaultGrapherConfig"
import {
    getSchemaVersion,
    hasValidSchema,
    isLatestVersion,
    hasOutdatedSchema,
    type AnyConfig,
    type AnyConfigWithValidSchema,
} from "./helpers"
import { runMigration } from "./migrations"

const recursivelyApplyMigrations = (
    config: AnyConfigWithValidSchema
): AnyConfigWithValidSchema => {
    const version = getSchemaVersion(config)
    if (isLatestVersion(version)) return config
    return recursivelyApplyMigrations(runMigration(config))
}

const migrate = (config: AnyConfigWithValidSchema): GrapherInterface =>
    recursivelyApplyMigrations(config) as GrapherInterface

/**
 * Attempts to migrate a config to the latest schema version.
 *
 * An outdated config is migrated to the latest version by applying a series of
 * predefined migrations. We rely on the schema version to determine if a config
 * is outdated.
 *
 * Note that the given config is not actually validated against the schema!
 */
export const migrateGrapherConfigToLatestVersion = (
    config: AnyConfig
): GrapherInterface => {
    // the config adheres to the latest schema
    if (config.$schema === defaultGrapherConfig.$schema) return config

    // if the schema version is outdated, migrate it
    if (hasValidSchema(config) && hasOutdatedSchema(config)) {
        return migrate(cloneDeep(config))
    }

    // throw if the schema is invalid or missing
    if (config.$schema === undefined) {
        throw new Error("Schema missing")
    } else {
        throw new Error(`Invalid schema: ${config.$schema}`)
    }
}
