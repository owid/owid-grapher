#! /usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import fs from "fs-extra"
import path from "path"

import { SVG_TESTER_SUITES, type SvgTesterSuite } from "@ourworldindata/types"
import { SVG_TESTER_REPO_PATH } from "../../settings/serverSettings.js"
import * as utils from "./utils.js"
import { hashMd5 } from "../../serverUtils/hash.js"

/**
 * Bring the md5 column of a suite's references/results.csv back in sync with the
 * .svg files next to it.
 */
async function main(args: ReturnType<typeof parseArguments>): Promise<void> {
    const testSuite = args.testSuite as SvgTesterSuite
    const referencesDir = path.join(
        SVG_TESTER_REPO_PATH,
        testSuite,
        "references"
    )

    if (!fs.existsSync(referencesDir))
        throw `Reference directory does not exist ${referencesDir}`

    const svgRecords = await utils.parseReferenceCsv(referencesDir)

    let updated = 0
    const missing: string[] = []

    for (const record of svgRecords) {
        const svgPath = path.join(referencesDir, record.svgFilename)
        if (!fs.existsSync(svgPath)) {
            missing.push(record.svgFilename)
            continue
        }

        // utf-8 to match how the file was written and how the md5 was computed
        // in the first place (renderSvg hashes the same string it writes out).
        const md5 = hashMd5(await fs.readFile(svgPath, "utf-8"))
        if (md5 !== record.md5) {
            utils.logIfVerbose(
                args.verbose,
                `${record.viewId}: ${record.md5} -> ${md5}`
            )
            record.md5 = md5
            updated += 1
        }
    }

    if (missing.length) {
        console.warn(
            `${missing.length} reference SVGs in results.csv do not exist on disk, left untouched`
        )
        for (const svgFilename of missing) {
            utils.logIfVerbose(args.verbose, `  missing: ${svgFilename}`)
        }
    }

    if (updated === 0) {
        console.log(`${testSuite}: all ${svgRecords.length} md5s already match`)
        return
    }

    await utils.writeReferenceCsv(referencesDir, svgRecords)
    console.log(
        `${testSuite}: updated ${updated} of ${svgRecords.length} md5s in results.csv`
    )
}

function parseArguments() {
    return yargs(hideBin(process.argv))
        .usage(
            "Recompute the md5 column in a test suite's references/results.csv from the reference SVGs on disk"
        )
        .command("$0 [testSuite]", false)
        .positional("testSuite", {
            type: "string",
            description: utils.TEST_SUITE_DESCRIPTION,
            default: "graphers",
            choices: SVG_TESTER_SUITES,
        })
        .options({
            verbose: {
                type: "boolean",
                description: "Verbose mode",
                default: false,
            },
        })
        .help()
        .alias("help", "h")
        .version(false)
        .parseSync()
}

const argv = parseArguments()
void main(argv)
