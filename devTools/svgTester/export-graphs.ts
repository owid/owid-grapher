#! /usr/bin/env node

import parseArgs from "minimist"
import * as utils from "./utils"
import * as fs from "fs-extra"

import * as path from "path"
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
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

    const dir = await fs.opendir(inDir)
    let directories = []
    for await (const entry of dir) {
        if (entry.isDirectory()) {
            directories.push(entry.name)
        }
    }

    directories.sort((a, b) => parseInt(a) - parseInt(b))
    directories = directories.map((dir) => path.join(inDir, dir))
    const directoriesToProcess = []
    for (let i = 0; i < directories.length; i++) {
        if (i % numPartitions === partition - 1) {
            directoriesToProcess.push(directories[i])
        }
    }

    const svgRecords: utils.SvgRecord[] = []
    for (const dir of directoriesToProcess) {
        const svgRecord = await utils.renderSvgAndSave(dir, outDir)
        svgRecords.push(svgRecord)
    }

    svgRecords.sort((a, b) => a.chartId - b.chartId)

    const resultsPath = path.join(outDir, "results.csv")
    const csvFileStream = fs.createWriteStream(resultsPath)
    csvFileStream.write(utils.svgCsvHeader + "\n")
    for (const row of svgRecords) {
        const line = `${row.chartId},${row.slug},${row.chartType},${row.md5},${row.svgFilename}`
        csvFileStream.write(line + "\n")
    }
    csvFileStream.end()
    await utils.finished(csvFileStream)
    csvFileStream.close()

    console.log("Done")
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
