#! /usr/bin/env node

import parseArgs from "minimist"
import * as utils from "./utils.js"
import * as fs from "fs-extra"

import * as path from "path"
import pMap from "p-map"
async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        const inDir = parsedArgs["i"] ?? "grapherData"
        const outDir = parsedArgs["o"] ?? "grapherSvgs"
        const numPartitions = parsedArgs["n"] ?? 1
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

        const jobDescriptions: utils.RenderSvgAndSaveJobDescription[] =
            directories.map((dir) => ({ dir: path.join(inDir, dir), outDir }))

        // Concurrently run the CPU heavy rendering jobs
        const svgRecords: utils.SvgRecord[] = await pMap(
            jobDescriptions,
            utils.renderSvgAndSave,
            { concurrency: 8 }
        )
        await utils.writeResultsCsvFile(outDir, svgRecords)
    } catch (error) {
        console.error("Encountered an error: ", error)
        // This call to exit is necessary for some unknown reason to make sure that the process terminates. It
        // was not required before introducing the multiprocessing library.
        process.exit(-1)
    }
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`export-graphs.js - utility to export grapher svg renderings and a summary csv file

Usage:
    export-graphs.js (-i DIR) (-o DIR)

Options:
    -i DIR         Input directory containing the data. [default: grapherData]
    -o DIR         Output directory that will contain the csv file and one svg file per grapher [default: grapherSvgs]
    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
