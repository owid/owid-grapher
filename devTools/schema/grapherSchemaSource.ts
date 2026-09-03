import * as fs from "node:fs/promises"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import * as _ from "lodash-es"
import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

export type SchemaDefinitions = NonNullable<JSONSchema7["$defs"]>

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(scriptDir, "..", "..")
export const SCHEMA_DIR = path.join(
    REPO_ROOT,
    "packages/@ourworldindata/grapher/src/schema"
)

const schemaFilePattern = /^grapher-schema\.(?<version>\d+)\.yaml$/

export async function findLatestSchemaFile(): Promise<{
    filePath: string
    fileName: string
    version: string
}> {
    const candidates = (await fs.readdir(SCHEMA_DIR))
        .map((fileName) => {
            const version = fileName.match(schemaFilePattern)?.groups?.version
            if (version === undefined) return undefined
            return { fileName, version }
        })
        .filter((file) => file !== undefined)

    const latest = _.maxBy(candidates, (file) => Number(file.version))
    if (!latest)
        throw new Error(`No versioned Grapher schema found in ${SCHEMA_DIR}`)

    return {
        filePath: path.join(SCHEMA_DIR, latest.fileName),
        fileName: latest.fileName,
        version: latest.version,
    }
}

/** The grapher schema uses neither boolean schemas nor tuple items */
function toSchemaObject(
    definition: JSONSchema7Definition | JSONSchema7Definition[]
): JSONSchema7 {
    if (typeof definition === "boolean" || Array.isArray(definition))
        throw new Error(
            `Unsupported schema form: ${JSON.stringify(definition)}`
        )
    return definition
}

export function resolveRef(
    rawSchema: JSONSchema7Definition | JSONSchema7Definition[],
    defs: SchemaDefinitions
): JSONSchema7 {
    const schema = toSchemaObject(rawSchema)
    if (!schema.$ref) return schema
    const defKey = schema.$ref.match(/^#\/\$defs\/(?<key>.+)$/)?.groups?.key
    const def = defKey === undefined ? undefined : defs[defKey]
    if (def === undefined)
        throw new Error(`Definition "${schema.$ref}" not found`)
    // Fields set alongside the $ref (e.g. a more specific description) win.
    return { ...toSchemaObject(def), ...schema, $ref: undefined }
}
