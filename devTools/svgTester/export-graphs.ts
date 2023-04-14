#! /usr/bin/env node

import parseArgs from "minimist"
import * as utils from "./utils.js"
import * as fs from "fs-extra"

import * as path from "path"
import workerpool from "workerpool"

function parseArgAsList(arg?: string): string[] {
    return (arg ?? "")
        .toString()
        .split(",")
        .map(String)
        .filter((entry: string) => entry)
}

async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        const inDir = parsedArgs["i"] ?? "../owid-grapher-svgs/configs"
        let outDir = parsedArgs["o"] ?? "../owid-grapher-svgs/svg"
        const targetConfigs: string[] = parseArgAsList(parsedArgs["c"])
        const targetChartTypes: string[] = parseArgAsList(parsedArgs["t"])

        // create a directory that contains the old and new svgs for easy comparing
        const enableComparisons =
            targetConfigs.length || targetChartTypes.length
        if (enableComparisons) {
            outDir = path.join(outDir, "comparisons")
        }

        if (!fs.existsSync(inDir))
            throw `Input directory does not exist ${inDir}`
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

        const dir = await fs.opendir(inDir)
        const directories = []
        for await (const entry of dir) {
            if (entry.isDirectory()) {
                if (!targetConfigs.length && !targetChartTypes.length) {
                    directories.push(entry.name)
                    continue
                }

                if (targetConfigs.includes(entry.name)) {
                    directories.push(entry.name)
                    continue
                }

                const configPath = path.join(inDir, entry.name, "config.json")
                const config = JSON.parse(fs.readFileSync(configPath, "utf8"))

                if (
                    targetChartTypes.includes(config.type) ||
                    (!config.type && targetChartTypes.includes("LineChart"))
                ) {
                    directories.push(entry.name)
                    continue
                }
            }
        }

        const n = directories.length
        console.log(`Generating ${n} SVG${n > 0 ? "s" : ""}...`)

        const jobDescriptions: utils.RenderSvgAndSaveJobDescription[] =
            directories.map((dir) => ({ dir: path.join(inDir, dir), outDir }))

        const pool = workerpool.pool(__dirname + "/worker.js", {
            minWorkers: 2,
        })

        // Parallelize the CPU heavy rendering jobs
        const svgRecords: utils.SvgRecord[] = await Promise.all(
            jobDescriptions.map((job) => pool.exec("renderSvgAndSave", [job]))
        )

        // Copy over copies from master for easy comparing
        if (enableComparisons) {
            const comparisonDir = await fs.opendir(outDir)
            const filenames: string[] = []
            for await (const file of comparisonDir) {
                if (file.name.includes("svg")) {
                    filenames.push(file.name)
                }
            }
            const svgPath = path.join(inDir, "..", "svg")
            const masterDir = await fs.opendir(svgPath)
            for await (const file of masterDir) {
                if (filenames.includes(file.name)) {
                    await fs.copyFile(
                        path.join(svgPath, file.name),
                        path.join(outDir, file.name.replace(".svg", "_old.svg"))
                    )
                }
            }
        }

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
    export-graphs.js (-i DIR) (-o DIR) (-c ID) (-t TYPE)

Options:
    -i DIR         Input directory containing the data. [default: ../owid-grapher-svgs/configs]
    -o DIR         Output directory that will contain the csv file and one svg file per grapher [default: ../owid-grapher-svgs/svg]
    -c ID          A comma-separated list of config IDs that you want to run instead of generating SVGs from all configs [default: undefined]
    -t TYPE        A comma-separated list of chart types that you want to run instead of generating SVGs from all configs [default: undefined]
    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
