import {
    latestSchemaVersion,
    outdatedSchemaVersions,
} from "../defaultGrapherConfig"

const allSchemaVersions = [...outdatedSchemaVersions, latestSchemaVersion]

type LatestSchemaVersion = typeof latestSchemaVersion
export type OutdatedSchemaVersion = (typeof outdatedSchemaVersions)[number]
export type SchemaVersion = OutdatedSchemaVersion | LatestSchemaVersion

type SchemaWithoutRevision =
    `https://files.ourworldindata.org/schemas/grapher-schema.${SchemaVersion}.json`
type SchemaWithRevision =
    `https://files.ourworldindata.org/schemas/grapher-schema.${SchemaVersion}.${number}.json`
type Schema = SchemaWithoutRevision | SchemaWithRevision

export type UntypedGrapherConfig = Record<string, any>
export type MigratableConfig = UntypedGrapherConfig & {
    $schema: Schema
}

const schemaUrlRegex =
    /https:\/\/files\.ourworldindata\.org\/schemas\/grapher-schema\.(?<version>\d{3})(?:\.(?<revision>\d{2}))?\.json/m

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
    const version = config.$schema.match(schemaUrlRegex)?.groups?.version
    if (!version || !isValidSchemaVersion(version)) return null
    return version
}

/** The revision of the schema document a config was written against, or undefined if its url names none */
export function getSchemaRevision(
    config: UntypedGrapherConfig
): number | undefined {
    if (typeof config.$schema !== "string") return undefined
    const revision = config.$schema.match(schemaUrlRegex)?.groups?.revision
    return revision === undefined ? undefined : Number(revision)
}

export function createSchemaForVersion(
    version: SchemaVersion
): SchemaWithoutRevision {
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
