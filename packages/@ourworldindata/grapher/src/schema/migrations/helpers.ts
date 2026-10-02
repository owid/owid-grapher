import {
    latestSchemaVersion,
    outdatedSchemaVersions,
} from "../defaultGrapherConfig"

const allSchemaVersions = [...outdatedSchemaVersions, latestSchemaVersion]

type LatestSchemaVersion = typeof latestSchemaVersion
export type OutdatedSchemaVersion = (typeof outdatedSchemaVersions)[number]
export type SchemaVersion = OutdatedSchemaVersion | LatestSchemaVersion

type Schema =
    `https://files.ourworldindata.org/schemas/grapher-schema.${SchemaVersion}.json`

export type UntypedGrapherConfig = Record<string, any>
export type MigratableConfig = UntypedGrapherConfig & {
    $schema: Schema
}

const schemaVersionRegex =
    /https:\/\/files\.ourworldindata\.org\/schemas\/grapher-schema\.(?<version>\d{3})\.json/m

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
    const version = config.$schema.match(schemaVersionRegex)?.groups?.version
    if (!version || !isValidSchemaVersion(version)) return null
    return version
}

export function createSchemaForVersion(version: SchemaVersion): Schema {
    return `https://files.ourworldindata.org/schemas/grapher-schema.${version}.json`
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
