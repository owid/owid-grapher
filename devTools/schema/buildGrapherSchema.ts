#! /usr/bin/env node

import * as fs from "node:fs/promises"
import * as path from "node:path"
import { parseArgs } from "node:util"
import { parse } from "yaml"
import type { JSONSchema7 } from "json-schema"
import {
    REPO_ROOT,
    SCHEMA_DIR,
    assertSchemaIdMatchesVersion,
    findLatestSchemaFile,
} from "./grapherSchemaSource.js"
import {
    chooseSchemaRevision,
    findHighestPublishedRevision,
    generateDefaultConfig,
    formatSchemaFileName,
    renderDefaultConfigFile,
    serializeJson,
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
            "publish-dir": publishDir,
            "published-dir": publishedDir,
            latest: withLatestAlias = false,
        },
    } = parseArgs({
        strict: true,
        options: {
            "publish-dir": { type: "string" },
            "published-dir": { type: "string" },
            latest: { type: "boolean" },
        },
    })

    const { filePath: sourcePath, version } = await findLatestSchemaFile()
    const schema = parse(await fs.readFile(sourcePath, "utf8")) as JSONSchema7
    assertSchemaIdMatchesVersion(schema, version)
    const defs = schema.$defs ?? {}

    const defaultConfigFile = await renderDefaultConfigFile(
        version,
        generateDefaultConfig(schema, defs)
    )
    await writeArtefact(
        path.join(SCHEMA_DIR, "defaultGrapherConfig.ts"),
        defaultConfigFile
    )

    if (publishDir) {
        const schemaJson = serializeJson(schema)
        const publishedFileNames = [
            formatSchemaFileName(version),
            ...(withLatestAlias ? [formatSchemaFileName("latest")] : []),
        ]
        await fs.mkdir(publishDir, { recursive: true })
        for (const fileName of publishedFileNames)
            await writeArtefact(path.join(publishDir, fileName), schemaJson)

        if (publishedDir) {
            const published = await readPublishedRevision(publishedDir, version)
            const decision = chooseSchemaRevision(schemaJson, published)
            if (decision.isChanged)
                await writeArtefact(
                    path.join(
                        publishDir,
                        formatSchemaFileName(version, decision.revision)
                    ),
                    schemaJson
                )
            else
                console.log(
                    `${formatSchemaFileName(version, decision.revision)} is current`
                )
        }
    }
}

/** The highest revision of a version already in the mirror, with the bytes it was published as */
async function readPublishedRevision(
    publishedDir: string,
    version: string
): Promise<{ revision: number; json: string } | undefined> {
    const fileNames = await fs.readdir(publishedDir)
    const revision = findHighestPublishedRevision(fileNames, version)
    if (revision === undefined) return undefined

    const json = await fs.readFile(
        path.join(publishedDir, formatSchemaFileName(version, revision)),
        "utf8"
    )
    return { revision, json }
}

void main()
