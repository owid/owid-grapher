#! /usr/bin/env node

import { getPublishedGraphersBySlug } from "../../baker/GrapherImageBaker.js"
import { defaultGrapherConfig } from "@ourworldindata/grapher"
import { diffGrapherConfigs } from "@ourworldindata/utils"

import { TransactionCloseMode, knexReadonlyTransaction } from "../../db/db.js"

import fs from "fs-extra"

import parseArgs from "minimist"
import * as utils from "./utils.js"
import pMap from "p-map"

async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        const outDir = parsedArgs["o"] ?? utils.DEFAULT_CONFIGS_DIR
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

        const { graphersBySlug } = await knexReadonlyTransaction(
            async (trx) => {
                return getPublishedGraphersBySlug(trx)
            },
            TransactionCloseMode.Close
        )
        const allGraphers = [...graphersBySlug.values()]
        const saveJobs: utils.SaveGrapherSchemaAndDataJob[] = allGraphers.map(
            (grapher) => {
                // since we're not baking defaults, we also exlcude them here
                return {
                    config: diffGrapherConfigs(grapher, defaultGrapherConfig),
                    outDir,
                }
            }
        )

        await pMap(saveJobs, utils.saveGrapherSchemaAndData, {
            concurrency: 32,
        })
    } catch (error) {
        console.error("Encountered an error: ", error)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(-1)
    }
}

const parsedArgs = parseArgs(process.argv.slice(2))

if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`Export configs and data for all graphers

Usage:
    dump-data.js [-o]

Options:
    -o   Output directory. Inside it one dir per grapher will be created. [default: ${utils.DEFAULT_CONFIGS_DIR}]
    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
