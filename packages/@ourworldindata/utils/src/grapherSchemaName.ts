export const SCHEMA_URL_BASE =
    "https://files.ourworldindata.org/schemas" as const

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

/** A revision as it appears in a schema name, zero-padded to two digits */
export type TwoDigitRevision = `${Digit}${Digit}`

export interface GrapherSchemaName {
    version: string
    revision?: number
}

const schemaFileNamePattern =
    /^grapher-schema\.(?<version>\d+)(?:\.(?<revision>\d{2}))?\.json$/

/** Reads the version and revision out of a schema file name or url */
export function parseGrapherSchemaName(
    fileNameOrUrl: string
): GrapherSchemaName | undefined {
    const fileName = fileNameOrUrl.split("/").at(-1) ?? ""
    const groups = fileName.match(schemaFileNamePattern)?.groups
    if (groups === undefined) return undefined

    const { version, revision } = groups
    return {
        version,
        revision: revision === undefined ? undefined : Number(revision),
    }
}

export function formatGrapherSchemaFileName(
    version: string,
    revision?: number
): string {
    if (revision === undefined) return `grapher-schema.${version}.json`
    return `grapher-schema.${version}.${String(revision).padStart(2, "0")}.json`
}

export function formatGrapherSchemaUrl(
    version: string,
    revision?: number
): string {
    return `${SCHEMA_URL_BASE}/${formatGrapherSchemaFileName(version, revision)}`
}
