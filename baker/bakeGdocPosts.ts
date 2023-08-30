#! /usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { SiteBaker } from "./SiteBaker.js"
import { BAKED_SITE_DIR, BAKED_BASE_URL } from "../settings/serverSettings.js"
import { Gdoc } from "../db/model/Gdoc/Gdoc.js"
import { OwidGdocPublished } from "@ourworldindata/utils"
import * as db from "../db/db.js"

yargs(hideBin(process.argv))
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

            await db.getConnection()
            await Promise.all(
                slugs.map(async (slug) => {
                    const gdoc = (await Gdoc.findOneByOrFail({
                        published: true,
                        slug: slug,
                    })) as OwidGdocPublished
                    await baker.bakeGDocPost(gdoc)
                })
            )
            process.exit(0)
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
