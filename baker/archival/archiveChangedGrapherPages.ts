import * as Sentry from "@sentry/node"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import * as db from "../../db/db.js"
import {
    findChangedGrapherPages,
    insertChartVersions,
} from "./ArchivalChecksumUtils.js"
import { bakeGrapherPagesToFolder } from "./ArchivalBaker.js"

interface Options {
    dir: string
    latestDir?: boolean
    dryRun?: boolean
}

const findChangedPagesAndArchive = async (opts: Options) => {
    await db.knexReadWriteTransaction(async (trx) => {
        const needToBeArchived = await findChangedGrapherPages(trx)

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

        const { date, manifests } = await bakeGrapherPagesToFolder(
            opts.dir,
            needToBeArchived,
            { copyToLatestDir: opts.latestDir }
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
