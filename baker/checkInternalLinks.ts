#! /usr/bin/env node

// Checks that every internal URL referenced from the baked HTML files
// resolves (after following redirects) to something the site would serve.
// Runs entirely against the baked output; no database or network access.

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import fs from "fs-extra"
import { BAKED_BASE_URL, BAKED_SITE_DIR } from "../settings/serverSettings.js"
import {
    checkInternalLinks,
    LinkCheckResult,
    LinkProblem,
} from "./linkChecker/checkInternalLinks.js"

function formatProblem(problem: LinkProblem, maxSources: number): string {
    const lines = [`${problem.url}  [${problem.status}]`]
    if (problem.hops.length > 1)
        lines.push(`    via ${problem.hops.slice(1).join(" -> ")}`)
    const shown = problem.sources.slice(0, maxSources)
    const remaining = problem.sources.length - shown.length
    lines.push(
        `    linked from ${shown.join(", ")}${remaining > 0 ? ` (+${remaining} more)` : ""}`
    )
    return lines.join("\n")
}

function printReport(result: LinkCheckResult, maxSources: number): void {
    console.log(
        `\nScanned ${result.pagesScanned} pages, ${result.uniqueUrls} unique internal URLs`
    )
    for (const [label, count] of Object.entries(result.counts).sort())
        console.log(`  ${label}: ${count}`)
    if (result.unreachablePages.length)
        console.log(
            `  (skipped ${result.unreachablePages.length} pages whose own URL is redirected elsewhere, e.g. ${result.unreachablePages[0]})`
        )

    if (result.tombstones.length) {
        console.log(
            `\n⚠️  ${result.tombstones.length} URL(s) point to deleted pages (served as 404):`
        )
        for (const problem of result.tombstones)
            console.log(formatProblem(problem, maxSources))
    }
    if (result.broken.length) {
        console.log(`\n❌ ${result.broken.length} broken internal URL(s):`)
        for (const problem of result.broken)
            console.log(formatProblem(problem, maxSources))
    } else {
        console.log("\n✅ No broken internal URLs")
    }
}

void yargs(hideBin(process.argv))
    .command<{
        dir: string
        baseUrl: string
        json?: string
        strict: boolean
        maxSources: number
    }>(
        "$0 [dir]",
        "Check that all internal URLs in a baked site resolve",
        (yargs) => {
            yargs
                .positional("dir", {
                    type: "string",
                    default: BAKED_SITE_DIR,
                    describe: "Directory containing the baked site",
                })
                .option("baseUrl", {
                    type: "string",
                    default: BAKED_BASE_URL,
                    describe:
                        "Base URL the site was baked with; absolute links to this host are checked",
                })
                .option("json", {
                    type: "string",
                    describe: "Write the full report to this JSON file",
                })
                .option("strict", {
                    type: "boolean",
                    default: false,
                    describe:
                        "Exit with a non-zero code if broken links are found",
                })
                .option("maxSources", {
                    type: "number",
                    default: 5,
                    describe: "How many linking pages to list per broken URL",
                })
        },
        async ({ dir, baseUrl, json, strict, maxSources }) => {
            const result = await checkInternalLinks({
                bakedSiteDir: dir,
                baseUrl,
                log: console.log,
            })
            printReport(result, maxSources)
            if (json) {
                await fs.writeJson(json, result, { spaces: 2 })
                console.log(`\nFull report written to ${json}`)
            }
            process.exit(strict && result.broken.length > 0 ? 1 : 0)
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
