#! /usr/bin/env node

import { getPublishedGraphersBySlug } from "../../baker/GrapherImageBaker.js"

import { closeTypeOrmAndKnexConnections } from "../../db/db.js"

import * as fs from "fs-extra"

import parseArgs from "minimist"
import * as utils from "./utils.js"
import * as path from "path"
import pMap from "p-map"

async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        const outDir = parsedArgs["o"] ?? "grapherData"
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

        const { graphersBySlug } = await getPublishedGraphersBySlug(false)
        const allGraphers = [...graphersBySlug.values()]
        const saveJobs: utils.SaveGrapherSchemaAndDataJob[] = allGraphers.map(
            (grapher) => ({ config: grapher, outDir })
        )

        await pMap(saveJobs, utils.saveGrapherSchemaAndData, { concurrency: 8 })

        await closeTypeOrmAndKnexConnections()
    } catch (error) {
        await closeTypeOrmAndKnexConnections()
        console.error("Encountered an error: ", error)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(-1)
    }
}

const parsedArgs = parseArgs(process.argv.slice(2))

if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`dump-data.js - utility to export configs and data for all graphers.

Usage:
    dump-data.js (-o DIR)

Options:
    -o DIR   Output directory. Inside it one dir per grapher will be created. [default: grapherData]
    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
