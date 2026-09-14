#! /usr/bin/env node

import * as fs from "node:fs/promises"
import * as _ from "lodash-es"
import { parse } from "yaml"
import type { JSONSchema7 } from "json-schema"
import {
    SCHEMA_URL_BASE,
    formatGrapherSchemaFileName,
} from "@ourworldindata/utils"
import {
    findDeclaredSchemaRevision,
    findLatestSchemaFile,
} from "./grapherSchemaSource.js"

async function main(): Promise<void> {
    const { filePath, version } = await findLatestSchemaFile()
    const schema = parse(await fs.readFile(filePath, "utf8")) as JSONSchema7

    const mutableFileName = formatGrapherSchemaFileName(version)
    const published = await fetchPublishedSchema(mutableFileName)
    if (published === undefined) return

    const declaredRevision = findDeclaredSchemaRevision(schema)
    const publishedRevision = findDeclaredSchemaRevision(published)
    if (declaredRevision === undefined || publishedRevision === undefined) {
        const missing =
            publishedRevision === undefined
                ? `The published ${mutableFileName}`
                : "This schema"
        console.log(`${missing} names no revision, so nothing was compared`)
        return
    }

    const declaredFileName = formatGrapherSchemaFileName(
        version,
        declaredRevision
    )
    const publishedFileName = formatGrapherSchemaFileName(
        version,
        publishedRevision
    )
    const nextFileName = formatGrapherSchemaFileName(
        version,
        publishedRevision + 1
    )

    if (_.isEqual(schema, published)) {
        console.log(`The schema matches the published ${publishedFileName}`)
        return
    }

    if (declaredRevision > publishedRevision) {
        console.log(
            `The schema declares ${declaredFileName}, which is unpublished`
        )
        return
    }

    if (declaredRevision === publishedRevision)
        console.error(
            `${declaredFileName} is already published, and this branch changes it. Move the revision in $id to publish as ${nextFileName}.`
        )
    else
        console.error(
            `${declaredFileName} is already published, and ${publishedFileName} is newer. Update this branch, then move the revision in $id to publish as ${nextFileName}.`
        )

    process.exitCode = 1
}

async function fetchPublishedSchema(
    fileName: string
): Promise<JSONSchema7 | undefined> {
    const url = `${SCHEMA_URL_BASE}/${fileName}`
    try {
        const response = await fetch(url)
        if (response.ok) return (await response.json()) as JSONSchema7
        console.log(
            `${url} responded ${response.status}, so the revision was not checked`
        )
    } catch {
        console.log(
            `${url} could not be fetched, so the revision was not checked`
        )
    }
    return undefined
}

void main()
