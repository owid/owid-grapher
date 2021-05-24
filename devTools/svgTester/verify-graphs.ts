#! /usr/bin/env node

import parseArgs from "minimist"
import * as utils from "./utils"
import * as fs from "fs-extra"

import * as path from "path"
import { ChartTypeName } from "../../grapher/core/GrapherConstants"
import md5 from "md5"
async function main(parsedArgs: parseArgs.ParsedArgs) {
    const verbose = false
    const inDir = parsedArgs["i"] ?? "grapherData"
    const referenceDir = parsedArgs["r"] ?? "grapherSvgs"
    const outDir = parsedArgs["o"] ?? "differentGrapherSvgs"
    const numPartitions = parsedArgs["n"] ?? 1
    const partition = parsedArgs["p"] ?? 1
    if (partition <= 0) throw "Partition must be >= 1"
    if (partition > numPartitions) throw "Partition must be <= numPartitions"
    if (numPartitions <= 0) throw "numPartitions must be >= 1"
    if (numPartitions > 1000) throw "numPartitions must be <= 1000"
    if (!fs.existsSync(inDir)) throw `Input directory does not exist ${inDir}`
    if (!fs.existsSync(referenceDir))
        throw `Reference directory does not exist ${inDir}`
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

    const dir = await fs.opendir(inDir)
    const directories = []
    for await (const entry of dir) {
        if (entry.isDirectory()) {
            directories.push(path.join(inDir, entry.name))
        }
    }

    directories.sort()
    const directoriesToProcess = []
    for (let i = 0; i < directories.length; i++) {
        if (i % numPartitions === partition - 1) {
            directoriesToProcess.push(directories[i])
        }
    }

    const results = await fs.readFile(
        path.join(referenceDir, "results.csv"),
        "utf-8"
    )
    const csvContentArray = results
        .split("\n")
        .splice(1)
        .map((line): [number, utils.SvgRecord] => {
            const items = line.split(",")
            const chartId = parseInt(items[0])
            return [
                chartId,
                {
                    chartId: chartId,
                    slug: items[1],
                    chartType: items[2] as ChartTypeName,
                    md5: items[3],
                },
            ]
        })
    const csvContentMap = new Map<number, utils.SvgRecord>(csvContentArray)

    const differences = []

    for (const dir of directoriesToProcess) {
        const [svg, svgRecord, outputPath] = await utils.renderSvg(
            dir,
            outDir,
            verbose
        )
        const referenceEntry = csvContentMap.get(svgRecord.chartId)
        if (referenceEntry === undefined)
            throw `Reference entry not found for ${svgRecord.chartId}`
        const newMd5 = svgRecord.md5
        if (newMd5 !== referenceEntry.md5) {
            console.warn(
                `Hash was different for ${svgRecord.chartId}. Reference is ${referenceEntry.md5}, current is ${newMd5}`
            )
            await fs.writeFile(outputPath, svg)
            differences.push(svgRecord.chartId)
        }
    }

    if (differences.length === 0) {
        console.log(
            `There were no differences in all ${directoriesToProcess.length} graphs processed`
        )
    } else {
        console.warn(`${differences.length} graphs had differences`)
    }
    console.log("Done")
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"]) {
    console.log(`verify-graphs.js - utility to check if grapher svg renderings have changed vs the reference export

Usage:
    export-graphs.js (-i DIR) (-o DIR)

Options:
    -i DIR         Input directory containing the data. [default: grapherData]
    -r DIR         Input directory containing the results.csv file to check against [default: grapherSvgs]
    -o DIR         Output directory that will contain the svg files that were different [default: differentGrapherSvgs]
    -n PARTITIONS  Number of partitions - if specified then only 1/PARTITIONS of directories will be processed [default: 1]
    -p PARTITION   Partition to process [ 1 - PARTITIONS ]. Specifies the partition to process in this run. [default: 1]
    `)
} else {
    main(parsedArgs)
}
