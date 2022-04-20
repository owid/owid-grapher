#! /usr/bin/env node

import parseArgs from "minimist"
import * as utils from "./utils.js"
import * as fs from "fs-extra"

import * as path from "path"
import workerpool from "workerpool"
async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        const inDir = parsedArgs["i"] ?? "grapherData"
        const outDir = parsedArgs["o"] ?? "grapherSvgs"
        const targetConfig = parsedArgs["c"]
        if (!fs.existsSync(inDir))
            throw `Input directory does not exist ${inDir}`
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

        const dir = await fs.opendir(inDir)
        const directories = []
        for await (const entry of dir) {
            if (entry.isDirectory()) {
                if (String(targetConfig) === entry.name) {
                    directories.push(entry.name)
                } else if (!targetConfig) {
                    directories.push(entry.name)
                }
            }
        }

        const jobDescriptions: utils.RenderSvgAndSaveJobDescription[] =
            directories.map((dir) => ({ dir: path.join(inDir, dir), outDir }))

        const pool = workerpool.pool(__dirname + "/worker.js", {
            minWorkers: 2,
        })

        // Parallelize the CPU heavy rendering jobs
        const svgRecords: utils.SvgRecord[] = await Promise.all(
            jobDescriptions.map((job) => pool.exec("renderSvgAndSave", [job]))
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
if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`export-graphs.js - utility to export grapher svg renderings and a summary csv file

Usage:
    export-graphs.js (-i DIR) (-o DIR) (-c ID)

Options:
    -i DIR         Input directory containing the data. [default: grapherData]
    -o DIR         Output directory that will contain the csv file and one svg file per grapher [default: grapherSvgs]
    -c ID          A specific config ID that you want to run instead of generating SVGs from all configs [default: undefined] 
    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
