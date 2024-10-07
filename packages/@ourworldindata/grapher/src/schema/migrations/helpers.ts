import {
    latestSchemaVersion,
    outdatedSchemaVersions,
} from "../defaultGrapherConfig"

const allSchemaVersions = [...outdatedSchemaVersions, latestSchemaVersion]

type LatestSchemaVersion = typeof latestSchemaVersion
type OutdatedSchemaVersion = (typeof outdatedSchemaVersions)[number]
type SchemaVersion = OutdatedSchemaVersion | LatestSchemaVersion

type Schema =
    `https://files.ourworldindata.org/schemas/grapher-schema.${SchemaVersion}.json`

// we can't type configs that don't adhere to the latest schema as we don't know what they look like
export type AnyConfig = Record<string, any>
export type AnyConfigWithValidSchema = AnyConfig & {
    $schema: Schema
}

const schemaVersionRegex =
    /https:\/\/files\.ourworldindata\.org\/schemas\/grapher-schema\.(?<version>\d{3})\.json/m

const isValidSchemaVersion = (version: string): version is SchemaVersion =>
    allSchemaVersions.includes(version as any)

export function getSchemaVersion(
    config: AnyConfigWithValidSchema
): SchemaVersion
export function getSchemaVersion(config: AnyConfig): SchemaVersion | null
export function getSchemaVersion(
    config: AnyConfig | AnyConfigWithValidSchema
): SchemaVersion | null {
    const version = config.$schema?.match(schemaVersionRegex)?.groups?.version
    if (!version || !isValidSchemaVersion(version)) return null
    return version
}

export function createSchemaForVersion(version: SchemaVersion): Schema {
    return `https://files.ourworldindata.org/schemas/grapher-schema.${version}.json`
}

export const isLatestVersion = (version: SchemaVersion) =>
    version === latestSchemaVersion

export const isOutdatedVersion = (version: SchemaVersion) =>
    outdatedSchemaVersions.includes(version as any)

export const hasValidSchema = (
    config: AnyConfig
): config is AnyConfigWithValidSchema => getSchemaVersion(config) !== null

export const hasOutdatedSchema = (
    config: AnyConfigWithValidSchema
): boolean => {
    const version = getSchemaVersion(config)
    return isOutdatedVersion(version)
}
