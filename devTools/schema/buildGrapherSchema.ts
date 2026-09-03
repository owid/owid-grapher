#! /usr/bin/env node

import * as fs from "node:fs/promises"
import * as path from "node:path"
import { parseArgs } from "node:util"
import { parse } from "yaml"
import type { JSONSchema7 } from "json-schema"
import {
    REPO_ROOT,
    SCHEMA_DIR,
    findLatestSchemaFile,
} from "./grapherSchemaSource.js"
import {
    generateDefaultConfig,
    buildSchemaArtefact,
    renderDefaultConfigFile,
    serializeJson,
    toLayerSchema,
} from "./grapherSchemaArtefacts.js"

function toDisplayPath(filePath: string): string {
    const relativePath = path.relative(REPO_ROOT, filePath)
    return relativePath.startsWith("..") ? filePath : relativePath
}

async function writeArtefact(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content)
    console.log(toDisplayPath(filePath))
}

async function main(): Promise<void> {
    const {
        values: {
            "out-dir": outDir = SCHEMA_DIR,
            latest: withLatestAlias = false,
        },
    } = parseArgs({
        strict: true,
        options: {
            "out-dir": { type: "string" },
            latest: { type: "boolean" },
        },
    })

    const { filePath: sourcePath, version } = await findLatestSchemaFile()
    const schema = parse(await fs.readFile(sourcePath, "utf8")) as JSONSchema7
    const defs = schema.$defs ?? {}

    const schemaJson = serializeJson(schema)
    const layerSchemaJson = serializeJson(toLayerSchema(schema))
    const defaultConfigFile = await renderDefaultConfigFile(
        version,
        generateDefaultConfig(schema, defs)
    )

    const versions = withLatestAlias ? [version, "latest"] : [version]
    const schemaArtefacts = versions.flatMap((artefactVersion) => [
        buildSchemaArtefact(artefactVersion, "json", schemaJson),
        buildSchemaArtefact(artefactVersion, "layer.json", layerSchemaJson),
    ])

    await fs.mkdir(outDir, { recursive: true })
    for (const { fileName, content } of schemaArtefacts)
        await writeArtefact(path.join(outDir, fileName), content)
    await writeArtefact(
        path.join(SCHEMA_DIR, "defaultGrapherConfig.ts"),
        defaultConfigFile
    )
}

void main()
