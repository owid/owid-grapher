#! /usr/bin/env node

import parseArgs from "minimist"
import * as utils from "./utils"
import * as fs from "fs-extra"
const { join } = require("path")

async function main(parsedArgs: parseArgs.ParsedArgs) {
    const inDir = parsedArgs["i"] ?? "grapherData"
    const outDir = parsedArgs["o"] ?? "grapherSvgs"
    const numPartitions = parsedArgs["n"] ?? 1
    const partition = parsedArgs["p"] ?? 1
    if (partition <= 0) throw "Partition must be >= 1"
    if (partition > numPartitions) throw "Partition must be <= numPartitions"
    if (numPartitions <= 0) throw "numPartitions must be >= 1"
    if (numPartitions > 1000) throw "numPartitions must be <= 1000"
    if (!fs.existsSync(inDir)) throw `Input directory does not exist ${inDir}`
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

    const dir = await fs.opendir(inDir)
    const directories = []
    for await (const entry of dir) {
        if (entry.isDirectory()) {
            directories.push(entry.name)
        }
    }

    const svgRecords: utils.SvgRecord[] = []
    for (const dir of directories) {
        console.log(dir)
        const svgRecord = await utils.renderSvgAndSave(join(inDir, dir), outDir)
        svgRecords.push(svgRecord)
    }

    await utils.writeResultsCsvFile(outDir, svgRecords)
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
    try {
        main(parsedArgs)
        process.exitCode = 0
    } catch (error) {
        console.error("Encountered an error", error)
        process.exitCode = 23
    }
}
