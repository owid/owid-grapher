// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import * as db from "../../db/db.js"
import {
    findChangedGrapherPages,
    getGrapherChecksumsFromDb,
    GrapherChecksumsObjectWithHash,
    insertChartVersions,
} from "./archivalChecksum.js"
import { bakeArchivalGrapherPagesToFolder } from "./ArchivalBaker.js"

interface Options {
    dir: string
    latestDir?: boolean
    dryRun?: boolean
    chartIds?: number[]
}

const findChangedPagesAndArchive = async (opts: Options) => {
    await db.knexReadWriteTransaction(async (trx) => {
        let needToBeArchived: GrapherChecksumsObjectWithHash[]
        if (opts.chartIds?.length) {
            console.log(
                "Archiving only the following chart IDs:",
                opts.chartIds.join(", ")
            )
            const allChecksums = await getGrapherChecksumsFromDb(trx)
            needToBeArchived = allChecksums.filter((c) =>
                opts.chartIds?.includes(c.chartId)
            )

            if (opts.chartIds.length !== needToBeArchived.length) {
                throw new Error(
                    `Not all chart IDs were found in the database. Found ${needToBeArchived.length} out of ${opts.chartIds.length}.`
                )
            }
        } else {
            needToBeArchived = await findChangedGrapherPages(trx)
        }

        if (opts.dryRun) {
            console.log(
                "Would archive",
                needToBeArchived.length,
                "pages with IDs:"
            )
            console.log(needToBeArchived.map((c) => c.chartId))
            return
        }
        if (needToBeArchived.length === 0) {
            console.log("No pages need to be archived, exiting.")
            return
        }

        const { date, manifests } = await bakeArchivalGrapherPagesToFolder(
            trx,
            opts.dir,
            needToBeArchived,
            { shouldCopyToLatestDir: opts.latestDir }
        )

        await insertChartVersions(trx, needToBeArchived, date, manifests)
    })

    process.exit(0)
}

void yargs(hideBin(process.argv))
    .command<Options>(
        "$0 [dir]",
        "Bake the site to a local folder",
        (yargs) => {
            yargs
                .positional("dir", {
                    type: "string",
                    default: "archive",
                    describe: "Directory to save the baked site",
                })
                .option("latestDir", {
                    type: "boolean",
                    description:
                        "Copy the baked site to a 'latest' directory, for ease of testing",
                })
                .option("dryRun", {
                    type: "boolean",
                    description: "Don't actually bake the site",
                })
                .option("chartIds", {
                    type: "array",
                    description:
                        "Only archive these chart IDs, and no matter whether they've changed or not",
                    coerce: (arg) => {
                        const splitAndParse = (s: string | number) =>
                            typeof s === "string"
                                ? s.split(/\s+|,/).map((x) => parseInt(x, 10))
                                : [s]

                        return Array.isArray(arg)
                            ? arg.flatMap(splitAndParse)
                            : splitAndParse(arg)
                    },
                })
        },
        async (opts) => {
            await findChangedPagesAndArchive(opts).catch(async (e) => {
                console.error("Error in findChangedPagesAndArchive:", e)
                Sentry.captureException(e)
                await Sentry.close()
                process.exit(1)
            })

            process.exit(0)
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
