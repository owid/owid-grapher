#! /usr/bin/env node

import { TransactionCloseMode, knexReadonlyTransaction } from "../../db/db.js"

import fs from "fs-extra"

import parseArgs from "minimist"

import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { google } from "googleapis"

async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        const auth = OwidGoogleAuth.getGoogleReadonlyAuth()
        const docs = google.docs({ version: "v1", auth })

        const response = await docs.documents.get({
            documentId: parsedArgs["_"][0],
            suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
        })
        // Remove the Authorization header from the response before printing it
        delete response.config.headers.Authorization
        process.stdout.write(JSON.stringify(response, null, 2))
    } catch (error) {
        console.error("Encountered an error: ", error)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(-1)
    }
}

const parsedArgs = parseArgs(process.argv.slice(2))

if (parsedArgs["h"] || parsedArgs["help"] || parsedArgs["_"].length === 0) {
    console.log(`Interact with the gdocs api via a CLI

Usage:
    gdocs.js <documentId>

    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
