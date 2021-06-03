#! /usr/bin/env node

import { getPublishedGraphersBySlug } from "../../baker/GrapherImageBaker"

import { closeTypeOrmAndKnexConnections } from "../../db/db"

import * as fs from "fs-extra"

import parseArgs from "minimist"
import * as utils from "./utils"

async function main(parsedArgs: parseArgs.ParsedArgs) {
    const outDir = parsedArgs["o"] ?? "grapherData"
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

    const { graphersBySlug } = await getPublishedGraphersBySlug(false)
    const allGraphers = [...graphersBySlug.values()]
    for (const grapher of allGraphers) {
        await utils.saveGrapherSchemaAndData(grapher, outDir)
    }
    await closeTypeOrmAndKnexConnections()
}

const parsedArgs = parseArgs(process.argv.slice(2))

if (parsedArgs["h"]) {
    console.log(`dump-data.js - utility to export configs and data for all graphers.

Usage:
    dump-data.js (-o DIR)

Options:
    -o DIR   Output directory. Inside it one dir per grapher will be created. [default: grapherData]
    `)
} else {
    try {
        main(parsedArgs)
        process.exitCode = 0
    } catch (error) {
        console.error("Encountered an error", error)
        process.exitCode = 23
    }
}
