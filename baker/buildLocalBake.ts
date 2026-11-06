#! /usr/bin/env node

import "../serverUtils/instrument.js"
import * as Sentry from "@sentry/node"

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { BakeStep, BakeStepConfig, bakeSteps, SiteBaker } from "./SiteBaker.js"
import fs from "fs-extra"
import { normalize } from "path"
import * as db from "../db/db.js"
import { DEFAULT_LOCAL_BAKE_DIR } from "../site/SiteConstants.js"
import { incrementalBakeSteps } from "./bakeState.js"

const bakeDomainToFolder = async (
    baseUrl = "http://localhost:3000/",
    dir = DEFAULT_LOCAL_BAKE_DIR,
    bakeSteps?: BakeStepConfig,
    incremental = false
) => {
    dir = normalize(dir)
    await fs.mkdirp(dir)
    const baker = new SiteBaker(dir, baseUrl, bakeSteps, { incremental })
    console.log(
        `Baking site ${incremental ? "incrementally" : "locally"} with baseUrl '${baseUrl}' to dir '${dir}'`
    )

    await db.knexReadonlyTransaction(
        (trx) => baker.bakeAll(trx),
        db.TransactionCloseMode.Close
    )
}

void yargs(hideBin(process.argv))
    .command<{
        baseUrl: string
        dir: string
        steps?: string[]
        incremental: boolean
    }>(
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
                    default: "localBake",
                    describe: "Directory to save the baked site",
                })
                .option("steps", {
                    type: "array",
                    choices: bakeSteps,
                    description: "Steps to perform during the baking process",
                })
                .option("incremental", {
                    type: "boolean",
                    default: false,
                    description: `Re-render only the pages whose database inputs changed since the previous bake into dir (steps: ${incrementalBakeSteps.join(", ")}); other steps run as usual`,
                })
        },
        async ({ baseUrl, dir, steps, incremental }) => {
            const bakeSteps = steps ? new Set(steps as BakeStep[]) : undefined
            await bakeDomainToFolder(baseUrl, dir, bakeSteps, incremental)
            await Sentry.close(2000)
            process.exit(0)
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
