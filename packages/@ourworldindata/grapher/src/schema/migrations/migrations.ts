// Schema migrations
//
// Every breaking change to the schema should be accompanied by a migration.
//
// To add a migration, follow these steps:
//    - Create a new function `migrateXXXToXXX` that migrates a config from one version to the next.
//      Make sure to update the $schema field to the next version in your migration function,
//      or else the recursively defined migrate function will not terminate!
//    - Add a new case to the match statement in `runMigration` that calls the new migration function.

import { match } from "ts-pattern"
import {
    type AnyConfigWithValidSchema,
    createSchemaForVersion,
    getSchemaVersion,
    isLatestVersion,
} from "./helpers"
import { GRAPHER_CHART_TYPES } from "@ourworldindata/types"

// see https://github.com/owid/owid-grapher/commit/26f2a0d1790c71bdda7e12f284ca552945d2f6ef
const migrateFrom001To002 = (
    config: AnyConfigWithValidSchema
): AnyConfigWithValidSchema => {
    delete config.selectedData
    config.$schema = createSchemaForVersion("002")
    return config
}

// see https://github.com/owid/owid-grapher/commit/4525ad81fb7064709ffab83677a8b0354b324dfb
const migrateFrom002To003 = (
    config: AnyConfigWithValidSchema
): AnyConfigWithValidSchema => {
    if (config.hideTitleAnnotation) {
        config.hideTitleAnnotations = {
            entity: true,
            time: true,
            change: true,
        }
    }
    delete config.hideTitleAnnotation

    config.$schema = createSchemaForVersion("003")
    return config
}

// see https://github.com/owid/owid-grapher/commit/1776721253cf61d7f1e24ebadeaf7a7ca2f43ced
const migrateFrom003To004 = (
    config: AnyConfigWithValidSchema
): AnyConfigWithValidSchema => {
    delete config.data
    config.$schema = createSchemaForVersion("004")
    return config
}

// see https://github.com/owid/owid-grapher/commit/1d67de3174764a413bc5055fbdf34efb2b49e079
const migrateFrom004To005 = (
    config: AnyConfigWithValidSchema
): AnyConfigWithValidSchema => {
    delete config.hideLinesOutsideTolerance
    config.$schema = createSchemaForVersion("005")
    return config
}

const migrateFrom005To006 = (
    config: AnyConfigWithValidSchema
): AnyConfigWithValidSchema => {
    const { type = GRAPHER_CHART_TYPES.LineChart, hasChartTab = true } = config

    // add types field
    if (!hasChartTab) config.chartTypes = []
    else if (type !== GRAPHER_CHART_TYPES.LineChart) config.chartTypes = [type]

    // remove deprecated fields
    delete config.type
    delete config.hasChartTab

    config.$schema = createSchemaForVersion("006")
    return config
}

export const runMigration = (
    config: AnyConfigWithValidSchema
): AnyConfigWithValidSchema => {
    const version = getSchemaVersion(config)
    if (isLatestVersion(version)) return config
    return match(version)
        .with("001", () => migrateFrom001To002(config))
        .with("002", () => migrateFrom002To003(config))
        .with("003", () => migrateFrom003To004(config))
        .with("004", () => migrateFrom004To005(config))
        .with("005", () => migrateFrom005To006(config))
        .exhaustive()
}
