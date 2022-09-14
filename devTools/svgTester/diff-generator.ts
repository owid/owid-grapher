#! /usr/bin/env node

import parseArgs from "minimist"
import * as utils from "./utils.js"
import * as fs from "fs-extra"
import readline from "readline"
import _ from "lodash"
import cheerio from "cheerio"

// This script generates an html report from a newline seprated list of chart ids that were different
// created with verify-graphs.ts. Github already shows nice diffs and for most cases it's easier
// to just look at files on Github but when there are a lot diffs this gets super slow. Also,
// this script generates an html file per chart type which can be useful.

const NUM_CHARTS_PER_PAGE = 30

function getPaginator(baseName: string, current: number, total: number) {
    const prev =
        current > 1
            ? `<li><a href="${baseName}-${current - 1}.html">previous</a></li>`
            : ""
    const next =
        current < total
            ? `<li><a href="${baseName}-${current + 1}.html">next</a></li>`
            : ""
    return `<ul>
        ${prev}
        ${next}
    </ul>`
}

async function main(parsedArgs: parseArgs.ParsedArgs) {
    try {
        // perpare and check arguments
        const inDir = parsedArgs["i"] ?? "grapherData"
        const referenceDir = parsedArgs["r"] ?? "grapherSvgs"
        const outDir = parsedArgs["o"] ?? "differentGrapherSvgs"
        const templateFile = parsedArgs["t"] ?? "diff-template.html"
        const suffix = parsedArgs["s"] ?? ""

        const referenceCsv = await utils.getReferenceCsvContentMap(referenceDir)
        const template = await fs.readFile(templateFile, {
            encoding: "utf-8",
        })

        const stdinBuffer = await fs.readFile(0, {
            encoding: "utf-8",
        }) // STDIN_FILENO = 0
        const ids = stdinBuffer
            .split("\n")
            .map((line) => Number.parseInt(line, 10))

        const idsGroupedByChartType = _.groupBy(
            ids,
            (id) => referenceCsv.get(id)?.chartType
        )
        console.log(
            "collected the following keys",
            Object.keys(idsGroupedByChartType)
        )

        const sections = []

        for (const group of Object.entries(idsGroupedByChartType)) {
            const groupName = group[0]
            const groupIds = group[1]
            console.log(`processing ${groupName}`)
            groupIds.sort((a, b) => b - a) // sort by id descending
            if (groupIds.length > 0) {
                const batches = _.chunk(groupIds, NUM_CHARTS_PER_PAGE)
                let counter = 1
                for (const batch of batches) {
                    console.log(
                        `processing batch ${counter} of ${batches.length}`
                    )
                    const $ = cheerio.load(template)
                    batch.forEach((id) =>
                        $("main").append(`<div class="row">
                        <div class="chart-id">${id}</div>
                        <div class="side-by-side">
                            <img src="${referenceDir}/${
                            referenceCsv.get(id)!.svgFilename
                        }"/>
                            <img src="${outDir}/${
                            referenceCsv.get(id)!.svgFilename
                        }"/>
                        </div>
                    </div>
                    `)
                    )
                    $("main").append(
                        getPaginator(groupName, counter, batches.length)
                    )
                    await fs.writeFile(`${groupName}-${counter}.html`, $.html())
                    counter += 1
                }
                sections.push(groupName)
            }
        }

        const $ = cheerio.load(template)

        const chapters = sections.map(
            (section) => `<li><a href="${section}-1.html">${section}</a></li>`
        )
        $("main").append(`<ul>
        ${chapters}
        </ul>`)
        await fs.writeFile(`index.html`, $.html())
    } catch (error) {
        console.error("Encountered an error: ", error)
    }
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`diff-generator.js - tool to generate an html report for files with svg differences. Reads newline separated ids from stdin

Usage:
    diff-generator.js (-i DIR) (-o DIR)

Options:
    -i DIR         Input directory containing the data. [default: grapherData]
    -r DIR         Input directory containing the results.csv file to check against [default: grapherSvgs]
    -o DIR         Output directory that will contain the svg files that were different [default: differentGrapherSvgs]
    -t PATH        Path to the template file to use
    -s SUFFIX      Suffix for different svg files to create <NAME><SUFFIX>.svg files - useful if you want to set output to the same as reference
    `)
    process.exit(0)
} else {
    main(parsedArgs)
}
