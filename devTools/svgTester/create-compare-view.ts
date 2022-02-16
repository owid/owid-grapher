#! /usr/bin/env node

import parseArgs from "minimist"
import * as utils from "./utils.js"
import fs from "fs-extra"
import path from "path"

async function main(parsedArgs: parseArgs.ParsedArgs) {
    // perpare and check arguments
    const referenceDir: string = parsedArgs["r"] ?? "grapherSvgs"
    const differencesDir: string = parsedArgs["d"] ?? "differentGrapherSvgs"
    const outFile: string = parsedArgs["o"] ?? "differences.html"
    if (!fs.existsSync(referenceDir))
        throw `Reference directory does not exist ${referenceDir}`
    if (!fs.existsSync(differencesDir))
        throw `Differences directory does not exist ${differencesDir}`

    const dir = await fs.opendir(differencesDir)
    const files = []
    for await (const entry of dir) {
        if (entry.isFile() && entry.name.endsWith("svg")) {
            files.push(entry.name)
        }
    }
    const sections = files.map((file) =>
        createSection(file, referenceDir, differencesDir)
    )
    await fs.writeFile(outFile, createHtml(sections.join("\n")))
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"]) {
    console.log(`create-compare-views.js - utility to create a simple HTML view from a folder of svgs that have differences vs the reference ones

Usage:
    create-compare-views.js (-d DIR) (-r DIR) (-o FILE)

Options:
    -r DIR   Input directory containing the reference svg files [default: grapherSvgs]
    -d DIR   Input directory with the svgs that were found to be different [default: differentGrapherSvgs]
    -o FILE  HTML Output filename to generate [default: differences.html]
    `)
} else {
    main(parsedArgs)
}

function createSection(
    filename: string,
    referenceDir: string,
    differencesDir: string
) {
    const referenceFilename = path.join(referenceDir, filename)
    const differencesFilename = path.join(differencesDir, filename)
    return `<section>
        <div class="svg reference">
            <img src="${referenceFilename}" alt="">
        </div>
        <div class="svg current">
            <img src="${differencesFilename}" alt="">
        </div>
    </section>`
}

function createHtml(content: string) {
    return `<!doctype html>

<html lang="en">

<head>
    <meta charset="utf-8">
    <title>Comparision</title>
    <style>
        section {
            display: flex;
        }

        .svg {
            max-width: 50%;
        }

        .svg img {
            width: 100%;
        }
    </style>
</head>

<body>
    ${content}
</body>

</html>`
}
