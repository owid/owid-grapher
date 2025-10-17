#! /usr/bin/env node

import parseArgs from "minimist"
import fs from "fs"
import path from "path"
import { docs as googleDocs } from "@googleapis/docs"
import type { docs_v1 } from "@googleapis/docs"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"

const MODES = [
    {
        label: "withoutSuggestions",
        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    },
    {
        label: "suggestionsInline",
        suggestionsViewMode: "SUGGESTIONS_INLINE",
    },
] as const

type SuggestionsViewMode = (typeof MODES)[number]["suggestionsViewMode"]

interface FetchOptions {
    client: docs_v1.Docs
    documentId: string
    suggestionsViewMode: SuggestionsViewMode
}

async function fetchDocument({
    client,
    documentId,
    suggestionsViewMode,
}: FetchOptions): Promise<docs_v1.Schema$Document | undefined> {
    const response = await client.documents.get({
        documentId,
        suggestionsViewMode,
    })
    // Remove the Authorization header from the response metadata before emitting output
    delete response.config?.headers?.Authorization
    return response.data
}

async function main(parsedArgs: parseArgs.ParsedArgs): Promise<void> {
    try {
        const documentId = parsedArgs["_"][0]
        const outputDir = parsedArgs["outDir"] ?? parsedArgs["o"]
        const shouldWriteFiles = typeof outputDir === "string"

        if (!documentId) {
            throw new Error("Missing <documentId> argument.")
        }

        if (shouldWriteFiles && !fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }

        const auth = OwidGoogleAuth.getGoogleReadonlyAuth()
        const docsClient = googleDocs({ version: "v1", auth })

        for (const mode of MODES) {
            const data = await fetchDocument({
                client: docsClient,
                documentId,
                suggestionsViewMode: mode.suggestionsViewMode,
            })
            if (shouldWriteFiles) {
                const filepath = path.join(
                    outputDir,
                    `${documentId}-${mode.label}.json`
                )
                fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
                console.log(`Wrote ${mode.label} response to ${filepath}`)
            } else {
                console.log(
                    `=== ${mode.label} (${mode.suggestionsViewMode}) ===`
                )
                console.log(JSON.stringify(data, null, 2))
            }
        }
    } catch (error) {
        console.error("Encountered an error:", error)
        process.exitCode = 1
    }
}

const parsedArgs = parseArgs(process.argv.slice(2))

if (parsedArgs["h"] || parsedArgs["help"] || parsedArgs["_"].length === 0) {
    console.log(`Fetch a Google Doc twice to compare suggestion handling.

Usage:
    yarn tsx devTools/gdocs/fetch-with-suggestions.ts <documentId> [--outDir ./tmp-downloads]

Options:
    --outDir, -o   Directory to write JSON responses instead of printing to stdout.
`)
    process.exit(0)
} else {
    void main(parsedArgs)
}
