import * as fs from "node:fs/promises"
import * as path from "node:path"
import { parse } from "yaml"

const schemaDir = path.resolve("src/schema")
const outputPath = path.resolve("dist/grapher-schema.json")
const schemaFilePattern = /^grapher-schema\.(?<version>\d+)\.yaml$/

async function getLatestSchemaPath(): Promise<string> {
    const schemaFiles = (await fs.readdir(schemaDir))
        .map((fileName) => {
            const match = schemaFilePattern.exec(fileName)
            if (!match?.groups) return undefined
            return { fileName, version: Number(match.groups.version) }
        })
        .filter((file): file is { fileName: string; version: number } => !!file)
        .sort((a, b) => b.version - a.version)

    const latestSchema = schemaFiles[0]
    if (!latestSchema)
        throw new Error(`No versioned Grapher schema found in ${schemaDir}`)

    return path.join(schemaDir, latestSchema.fileName)
}

async function buildLatestGrapherSchema(): Promise<void> {
    const sourcePath = await getLatestSchemaPath()
    const schema = parse(await fs.readFile(sourcePath, "utf8")) as unknown

    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`)
}

await buildLatestGrapherSchema()
