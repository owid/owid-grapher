#! /usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { SiteBaker } from "./SiteBaker.js"
import { BAKED_SITE_DIR, BAKED_BASE_URL } from "../settings/serverSettings.js"
import * as db from "../db/db.js"

void yargs(hideBin(process.argv))
    .command<{ slugs: string[] }>(
        "$0 [slug]",
        "Bake multiple GDoc posts",
        (yargs) => {
            yargs
                .option("slugs", {
                    type: "array",
                    describe: "GDoc slugs",
                })
                .demandOption(
                    ["slugs"],
                    "Please provide slugs using --slugs slug1 slug2"
                )
        },
        async ({ slugs }) => {
            const baker = new SiteBaker(BAKED_SITE_DIR, BAKED_BASE_URL)

            // TODO: this transaction is only RW because somewhere inside it we fetch images
            await db.knexReadWriteTransaction(
                (trx) => baker.bakeGDocPosts(trx, slugs),
                db.TransactionCloseMode.Close
            )
            process.exit(0)
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
