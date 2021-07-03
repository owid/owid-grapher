#! /usr/bin/env node

import parseArgs from "minimist"
import * as utils from "./utils"
import * as fs from "fs-extra"
const { join } = require("path")

import * as path from "path"
const Pool = require("multiprocessing").Pool
const pool = new Pool()
async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        const inDir = parsedArgs["i"] ?? "grapherData"
        const outDir = parsedArgs["o"] ?? "grapherSvgs"
        const numPartitions = parsedArgs["n"] ?? 1
        const partition = parsedArgs["p"] ?? 1
        if (partition <= 0) throw "Partition must be >= 1"
        if (partition > numPartitions)
            throw "Partition must be <= numPartitions"
        if (numPartitions <= 0) throw "numPartitions must be >= 1"
        if (numPartitions > 1000) throw "numPartitions must be <= 1000"
        if (!fs.existsSync(inDir))
            throw `Input directory does not exist ${inDir}`
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

        const dir = await fs.opendir(inDir)
        const directories = []
        for await (const entry of dir) {
            if (entry.isDirectory()) {
                directories.push(entry.name)
            }
        }

        const jobDescriptions: utils.RenderSvgAndSaveJobDescription[] = directories.map(
            (dir) => ({ dir: join(inDir, dir), outDir })
        )

        // Parellize the CPU heavy rendering using the multiprocessing library. This library stringifies the invocation to other processes
        // so this call uses the intermediate dump-data-runner script. This call will then in parallel take the descriptions of the SaveGrapherSchemaAndDataJob,
        // and dump the grapher config and data json file in parallel. The entire parallel operation returns a promise containing an array
        // or result values which in this case is void so is ignored
        const svgRecords: utils.SvgRecord[] = await pool.map(
            jobDescriptions,
            path.join(__dirname, "export-graphs-runner.js")
        )
        await utils.writeResultsCsvFile(outDir, svgRecords)

        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(0)
    } catch (error) {
        console.error("Encountered an error: ", error)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(-1)
    }
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"]) {
    console.log(`export-graphs.js - utility to export grapher svg renderings and a summary csv file

Usage:
    export-graphs.js (-i DIR) (-o DIR)

Options:
    -i DIR         Input directory containing the data. [default: grapherData]
    -o DIR         Output directory that will contain the csv file and one svg file per grapher [default: grapherSvgs]
    -n PARTITIONS  Number of partitions - if specified then only 1/PARTITIONS of directories will be processed [default: 1]
    -p PARTITION   Partition to process [ 1 - PARTITIONS ]. Specifies the partition to process in this run. [default: 1]
    `)
} else {
    main(parsedArgs)
}
