import {
    SCHEMA_URL_BASE,
    type TwoDigitRevision,
    parseGrapherSchemaName,
} from "@ourworldindata/utils"
import {
    latestSchemaVersion,
    outdatedSchemaVersions,
} from "../defaultGrapherConfig"

const allSchemaVersions = [...outdatedSchemaVersions, latestSchemaVersion]

type LatestSchemaVersion = typeof latestSchemaVersion
export type OutdatedSchemaVersion = (typeof outdatedSchemaVersions)[number]
export type SchemaVersion = OutdatedSchemaVersion | LatestSchemaVersion

type SchemaWithoutRevision =
    `${typeof SCHEMA_URL_BASE}/grapher-schema.${SchemaVersion}.json`
type SchemaWithRevision =
    `${typeof SCHEMA_URL_BASE}/grapher-schema.${SchemaVersion}.${TwoDigitRevision}.json`
type Schema = SchemaWithoutRevision | SchemaWithRevision

export type UntypedGrapherConfig = Record<string, any>
export type MigratableConfig = UntypedGrapherConfig & {
    $schema: Schema
}

const isValidSchemaVersion = (version: string): version is SchemaVersion =>
    allSchemaVersions.includes(version as any)

export function getSchemaVersion(config: MigratableConfig): SchemaVersion
export function getSchemaVersion(
    config: UntypedGrapherConfig
): SchemaVersion | null
export function getSchemaVersion(
    config: UntypedGrapherConfig | MigratableConfig
): SchemaVersion | null {
    if (typeof config.$schema !== "string") return null
    const version = parseGrapherSchemaName(config.$schema)?.version
    if (!version || !isValidSchemaVersion(version)) return null
    return version
}

export function createSchemaForVersion(
    version: SchemaVersion
): SchemaWithoutRevision {
    return `${SCHEMA_URL_BASE}/grapher-schema.${version}.json`
}

export const isLatestVersion = (
    version: SchemaVersion
): version is LatestSchemaVersion => version === latestSchemaVersion

export function getNextSchemaVersion(
    version: OutdatedSchemaVersion
): SchemaVersion {
    return allSchemaVersions[allSchemaVersions.indexOf(version) + 1]
}

export const isOutdatedVersion = (
    version: SchemaVersion
): version is OutdatedSchemaVersion => !isLatestVersion(version)

export const hasKnownSchemaVersion = (
    config: UntypedGrapherConfig
): config is MigratableConfig => getSchemaVersion(config) !== null
