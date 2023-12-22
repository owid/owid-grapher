#! /usr/bin/env node

import parseArgs from "minimist"
import fs from "fs-extra"
import path from "path"
import * as utils from "./utils.js"
import _ from "lodash"

const DEFAULT_REPORT_FILENAME = "../owid-grapher-svgs/differences.html"

const LIVE_GRAPHER_URL = "https://ourworldindata.org/grapher"
const LOCAL_GRAPHER_URL = "http://localhost:3030/grapher"

async function main(parsedArgs: parseArgs.ParsedArgs) {
    // prepare and check arguments
    const referenceDir: string = parsedArgs["r"] ?? utils.DEFAULT_REFERENCE_DIR
    const differencesDir: string =
        parsedArgs["d"] ?? utils.DEFAULT_DIFFERENCES_DIR
    const outFile: string = parsedArgs["o"] ?? DEFAULT_REPORT_FILENAME

    if (!fs.existsSync(referenceDir))
        throw `Reference directory does not exist ${referenceDir}`
    if (!fs.existsSync(differencesDir))
        throw `Differences directory does not exist ${differencesDir}`

    // collect svg files with differences
    const dir = await fs.opendir(differencesDir)
    const svgFilesWithDifferences = []
    for await (const entry of dir) {
        if (entry.isFile() && entry.name.endsWith("svg")) {
            svgFilesWithDifferences.push(entry.name)
        }
    }

    // get reference records for each svg with differences
    const referenceData = await utils.parseReferenceCsv(referenceDir)
    const referenceDataByFilename = new Map(
        referenceData.map((record) => [record.svgFilename, record])
    )
    const svgRecords = _.sortBy(
        svgFilesWithDifferences.map(
            (filename) => referenceDataByFilename.get(filename)!
        ),
        "slug"
    )

    // prepare HTML report
    const sections = svgRecords.map((record) =>
        createComparisonView(record, referenceDir, differencesDir)
    )
    const summary = `<p class="summary">Number of differences: ${sections.length}</p>`
    const content = summary + sections.join("\n")
    await fs.writeFile(outFile, createHtml(content))
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`create-compare-views.js - utility to create a simple HTML view from a folder of svgs that have differences vs the reference ones

Usage:
    create-compare-views.js (-d DIR) (-r DIR) (-o FILE)

Options:
    -r DIR   Input directory containing the reference svg files [default: ${utils.DEFAULT_REFERENCE_DIR}]
    -d DIR   Input directory with the svgs that were found to be different [default: ${utils.DEFAULT_DIFFERENCES_DIR}]
    -o FILE  HTML Output filename to generate [default: ${DEFAULT_REPORT_FILENAME}]
    `)
} else {
    main(parsedArgs)
}

function createComparisonView(
    svgRecord: utils.SvgRecord,
    referenceDir: string,
    differencesDir: string
) {
    const { svgFilename, slug } = svgRecord

    const referenceFilename = path.join(referenceDir, svgFilename)
    const differencesFilename = path.join(differencesDir, svgFilename)

    const queryStr = svgRecord.queryStr ? `?${svgRecord.queryStr}` : ""

    return `<section>
        <h2>${slug}${queryStr}</h2>
        <div class="side-by-side">
            <a href="${LIVE_GRAPHER_URL}/${slug}${queryStr}" target="_blank">
                <img src="${referenceFilename}" loading="lazy">
            </a>
            <a href="${LOCAL_GRAPHER_URL}/${slug}${queryStr}" target="_blank">
                <img src="${differencesFilename}" loading="lazy">
            </a>
        </div>
    </section>`
}

function createHtml(content: string) {
    return `<!doctype html>

<html lang="en">

<head>
    <meta charset="utf-8">
    <title>Comparison</title>
    <style>
        .summary {
            text-align: center;
        }

        section + section {
            margin-top: 60px;
        }

        h2 {
            font-size: 1.2rem;
            text-align: center;
        }

        .side-by-side {
            display: flex;
        }

        .side-by-side > * {
            flex: 1;
            max-width: 50%;
        }

        img {
            max-width: 100%;
        }
    </style>
</head>

<body>
    ${content}
</body>

</html>`
}
