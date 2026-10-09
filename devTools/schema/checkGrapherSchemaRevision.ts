#! /usr/bin/env node

import * as fs from "node:fs/promises"
import { parse } from "yaml"
import type { JSONSchema7 } from "json-schema"
import {
    SCHEMA_URL_BASE,
    formatGrapherSchemaFileName,
} from "@ourworldindata/utils"
import { findLatestSchemaFile } from "./grapherSchemaSource.js"
import { compareSchemaToPublished } from "./grapherSchemaRevisionCheck.js"

async function main(): Promise<void> {
    const { filePath, version } = await findLatestSchemaFile()
    const schema = parse(await fs.readFile(filePath, "utf8")) as JSONSchema7

    const mutableFileName = formatGrapherSchemaFileName(version)
    const published = await fetchPublishedSchema(mutableFileName)
    if (published === undefined) return

    const result = compareSchemaToPublished(version, schema, published)
    if (result.isPassing) {
        console.log(result.message)
        return
    }
    console.error(result.message)
    process.exitCode = 1
}

async function fetchPublishedSchema(
    fileName: string
): Promise<JSONSchema7 | undefined> {
    const url = `${SCHEMA_URL_BASE}/${fileName}`
    const response = await fetch(url)
    if (response.ok) return (await response.json()) as JSONSchema7
    if (response.status === 404) {
        console.log(`${url} is unpublished, so the revision was not checked`)
        return undefined
    }
    throw new Error(`${url} responded ${response.status}`)
}

void main()
