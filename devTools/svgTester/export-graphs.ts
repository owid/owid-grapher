#! /usr/bin/env node

import parseArgs from "minimist"
import * as utils from "./utils.js"
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
            directories.map((dir) => ({ dir: join(inDir, dir), outDir }))

        // Parallelize the CPU heavy rendering using the multiprocessing library. This library stringifies the invocation to other processes
        // so this call uses the intermediate export-graphs-runner script. This call will then in parallel take the descriptions of the RenderSvgAndSaveJobDescription,
        // and render the svgs in parallel. It will then save the resulting svg and return an SvgRecord which contains the md5 hash of the entire svg.
        // The entire parallel operation returns a promise containing an array of SvgRecrod result values. This is then written out as a csv file so that the verify
        // script can read it and quickly check md5 hashes for verification
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
