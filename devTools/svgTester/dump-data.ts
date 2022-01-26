#! /usr/bin/env node

import { getPublishedGraphersBySlug } from "../../baker/GrapherImageBaker"

import { closeTypeOrmAndKnexConnections } from "../../db/db"

import * as fs from "fs-extra"

import parseArgs from "minimist"
import * as utils from "./utils"
import * as path from "path"
const Pool = require("multiprocessing").Pool
const pool = new Pool()

async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        const outDir = parsedArgs["o"] ?? "grapherData"
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

        const { graphersBySlug } = await getPublishedGraphersBySlug(false)
        const allGraphers = [...graphersBySlug.values()]
        const saveJobs: utils.SaveGrapherSchemaAndDataJob[] = allGraphers.map(
            (grapher) => ({ config: grapher, outDir })
        )

        // TODO: the below code using the multiprocessing library does not work because the mysql connections get exceeded. I thought
        // that multiprocessing would be running one process per CPU and each would re-use the connection inside itself and close it on
        // process exit (this seems to be what is done in db.ts) but apparently there is an issue somewhere. The code below would probably
        // speed up exporting by a factor of ~2 on most systems but it's not super important to make this work

        // Parallelize the individual exports using the multiprocessing library. This library stringifies the invocation to other processes
        // so this call uses the intermediate dump-data-runner script. This call will then in parallel take the descriptions of the SaveGrapherSchemaAndDataJob,
        // and dump the grapher config and data json file in parallel. The entire parallel operation returns a promise containing an array
        // or result values which in this case is void so is ignored
        // await pool.map(saveJobs, path.join(__dirname, "dump-data-runner.js"))

        // single threaded solution for now
        for (const job of saveJobs) {
            await utils.saveGrapherSchemaAndData(job)
        }

        await closeTypeOrmAndKnexConnections()
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(0)
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
