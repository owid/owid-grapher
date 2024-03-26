#! /usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { SiteBaker } from "./SiteBaker.js"
import { BAKED_SITE_DIR, BAKED_BASE_URL } from "../settings/serverSettings.js"
import * as db from "../db/db.js"

yargs(hideBin(process.argv))
    .command<{ slug: string }>(
        "$0 [slug]",
        "Bake single GDoc post",
        (yargs) => {
            yargs.positional("slug", {
                type: "string",
                describe: "GDoc slug",
            })
        },
        async ({ slug }) => {
            const baker = new SiteBaker(BAKED_SITE_DIR, BAKED_BASE_URL)

            await db.getConnection()
            await db.knexReadonlyTransaction((trx) =>
                baker.bakeGDocPosts(trx, [slug])
            )
            process.exit(0)
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
