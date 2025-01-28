#! /usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { BakeStep, BakeStepConfig, bakeSteps, SiteBaker } from "./SiteBaker.js"
import fs from "fs-extra"
import path, { normalize } from "path"
import * as db from "../db/db.js"
import { bakeSingleGrapherPageForArchival } from "./GrapherBaker.js"
import { keyBy } from "lodash"
import { getAllImages } from "../db/model/Image.js"
import { getChartConfigBySlug } from "../db/model/Chart.js"

const DIR = "archive"

const bakeDomainToFolder = async (
    baseUrl = "http://localhost:3000/",
    dir = DIR,
    bakeSteps?: BakeStepConfig
) => {
    dir = normalize(dir)
    await fs.mkdirp(dir)
    await fs.mkdirp(path.join(dir, "grapher"))

    const assetMap = {
        "owid.mjs": "yeah_this_worked.mjs",
        "owid.css": "yeah_this_worked.css",
    }
    const baker = new SiteBaker(dir, baseUrl, bakeSteps, assetMap)

    console.log(`Baking site locally with baseUrl '${baseUrl}' to dir '${dir}'`)

    const SLUG = "life-expectancy"

    await db.knexReadonlyTransaction(async (trx) => {
        const imageMetadataDictionary = await getAllImages(trx).then((images) =>
            keyBy(images, "filename")
        )
        const chart = await getChartConfigBySlug(trx, SLUG)
        await bakeSingleGrapherPageForArchival(dir, chart.config, trx, {
            imageMetadataDictionary,
            assetMap,
        })
    }, db.TransactionCloseMode.Close)
}

void yargs(hideBin(process.argv))
    .command<{ baseUrl: string; dir: string; steps?: string[] }>(
        "$0 [baseUrl] [dir]",
        "Bake the site to a local folder",
        (yargs) => {
            yargs
                .positional("baseUrl", {
                    type: "string",
                    default: "http://localhost:3000/",
                    describe: "Base URL of the site",
                })
                .positional("dir", {
                    type: "string",
                    default: "archive",
                    describe: "Directory to save the baked site",
                })
                .option("steps", {
                    type: "array",
                    choices: bakeSteps,
                    description: "Steps to perform during the baking process",
                })
        },
        async ({ baseUrl, dir, steps }) => {
            const bakeSteps = steps ? new Set(steps as BakeStep[]) : undefined
            await bakeDomainToFolder(baseUrl, dir, bakeSteps)
            process.exit(0)
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
