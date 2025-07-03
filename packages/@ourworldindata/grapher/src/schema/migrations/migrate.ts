import * as _ from "lodash-es"
import { GrapherInterface } from "@ourworldindata/types"

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
import * as Sentry from "@sentry/browser"

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
        return migrate(_.cloneDeep(config))
    }

    // throw if the schema is missing
    if (config.$schema === undefined) {
        throw new Error("Schema missing")
    } else {
        /**
         * If the schema version is not outdated and not the latest, we have most likely received a
         * config from a future version of the codebase, that the client code is not yet aware of.
         * That's not perfect, but in reality, most schema changes are benign changes,
         * and rendering the config with the current code will result in a better user experience
         * than just throwing an error and grapher not rendering at all without any explanation.
         * - @marcelgerber, 2025-07-02
         */
        const message = `Received grapher config with unsupported schema ${config.$schema}; this code expects schema ${defaultGrapherConfig.$schema}.`
        console.warn(message)
        Sentry.captureMessage(message, {
            level: "warning",
        })
        return config
    }
}

export const migrateGrapherConfigToLatestVersionAndFailOnError = (
    config: AnyConfig
): GrapherInterface => {
    const migrated = migrateGrapherConfigToLatestVersion(config)

    if (migrated.$schema !== defaultGrapherConfig.$schema) {
        throw new Error(
            `Invalid schema version after schema migration: ${migrated.$schema}. Expected: ${defaultGrapherConfig.$schema}`
        )
    }
    return migrated
}
