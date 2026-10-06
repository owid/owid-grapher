// Schema migrations
//
// To add a migration: write `migrateFromNNNToMMM`, which rewrites a config's content from
// version NNN to MMM and nothing else, then add its `"NNN"` entry to `MIGRATION_STEPS`.

import {
    type AnyConfigWithValidSchema,
    createSchemaForVersion,
    getNextSchemaVersion,
    type OutdatedSchemaVersion,
    type SchemaVersion,
} from "./helpers"
import { GRAPHER_CHART_TYPES } from "@ourworldindata/types"

type MigrationStep = (config: AnyConfigWithValidSchema) => void

// see https://github.com/owid/owid-grapher/commit/26f2a0d1790c71bdda7e12f284ca552945d2f6ef
const migrateFrom001To002 = (config: AnyConfigWithValidSchema): void => {
    delete config.selectedData
}

// see https://github.com/owid/owid-grapher/commit/4525ad81fb7064709ffab83677a8b0354b324dfb
const migrateFrom002To003 = (config: AnyConfigWithValidSchema): void => {
    if (config.hideTitleAnnotation) {
        config.hideTitleAnnotations = {
            entity: true,
            time: true,
            change: true,
        }
    }
    delete config.hideTitleAnnotation
}

// see https://github.com/owid/owid-grapher/commit/1776721253cf61d7f1e24ebadeaf7a7ca2f43ced
const migrateFrom003To004 = (config: AnyConfigWithValidSchema): void => {
    delete config.data
}

// see https://github.com/owid/owid-grapher/commit/1d67de3174764a413bc5055fbdf34efb2b49e079
const migrateFrom004To005 = (config: AnyConfigWithValidSchema): void => {
    delete config.hideLinesOutsideTolerance
}

const migrateFrom005To006 = (config: AnyConfigWithValidSchema): void => {
    const { type = GRAPHER_CHART_TYPES.LineChart, hasChartTab = true } = config

    // add types field
    if (!hasChartTab) config.chartTypes = []
    else if (type !== GRAPHER_CHART_TYPES.LineChart) config.chartTypes = [type]

    // remove deprecated fields
    delete config.type
    delete config.hasChartTab
}

const migrateFrom006To007 = (config: AnyConfigWithValidSchema): void => {
    // rename map.projection to map.region
    if (config.map?.projection) {
        config.map.region = config.map.projection
        delete config.map.projection
    }
}

const migrateFrom007To008 = (config: AnyConfigWithValidSchema): void => {
    // remove colorScale.customNumericMinValue, merge it into colorScale.customNumericValues
    if (config.map?.colorScale?.customNumericValues) {
        config.map.colorScale.customNumericValues = [
            config.map.colorScale.customNumericMinValue ?? 0,
            ...config.map.colorScale.customNumericValues,
        ]
    }
    if (config.map?.colorScale?.customNumericMinValue !== undefined) {
        delete config.map.colorScale.customNumericMinValue
    }

    if (config.colorScale?.customNumericValues) {
        config.colorScale.customNumericValues = [
            config.colorScale.customNumericMinValue ?? 0,
            ...config.colorScale.customNumericValues,
        ]
    }
    if (config.colorScale?.customNumericMinValue !== undefined) {
        delete config.colorScale.customNumericMinValue
    }
}

const migrateFrom008To009 = (config: AnyConfigWithValidSchema): void => {
    if ((config.map?.colorScale?.binningStrategy ?? "manual") !== "manual") {
        config.map.colorScale.binningStrategy = "auto"
    }

    if (config.map?.colorScale?.binningStrategyBinCount !== undefined) {
        delete config.map.colorScale.binningStrategyBinCount
    }

    if ((config.colorScale?.binningStrategy ?? "manual") !== "manual") {
        config.colorScale.binningStrategy = "auto"
    }

    if (config.colorScale?.binningStrategyBinCount !== undefined) {
        delete config.colorScale.binningStrategyBinCount
    }
}

const migrateFrom009To010 = (config: AnyConfigWithValidSchema): void => {
    // Rename hideLegend to hideSeriesLabels
    if (config.hideLegend) {
        config.hideSeriesLabels = true
        delete config.hideLegend
    }
}

const migrateFrom010To011 = (config: AnyConfigWithValidSchema): void => {
    // Drop the deprecated yearIsDay flag in favor of timeInterval
    for (const dimension of config.dimensions ?? []) {
        const display = dimension.display
        if (!display) continue
        if (
            display.yearIsDay === true &&
            (display.timeInterval === undefined ||
                display.timeInterval === null)
        )
            display.timeInterval = "day"
        delete display.yearIsDay
    }
}

const MIGRATION_STEPS: Record<OutdatedSchemaVersion, MigrationStep> = {
    "001": migrateFrom001To002,
    "002": migrateFrom002To003,
    "003": migrateFrom003To004,
    "004": migrateFrom004To005,
    "005": migrateFrom005To006,
    "006": migrateFrom006To007,
    "007": migrateFrom007To008,
    "008": migrateFrom008To009,
    "009": migrateFrom009To010,
    "010": migrateFrom010To011,
}

/** Applies the step for `version`, restamps `$schema` and returns the new version */
export const runMigration = (
    config: AnyConfigWithValidSchema,
    version: OutdatedSchemaVersion
): SchemaVersion => {
    MIGRATION_STEPS[version](config)
    const nextVersion = getNextSchemaVersion(version)
    config.$schema = createSchemaForVersion(nextVersion)
    return nextVersion
}
