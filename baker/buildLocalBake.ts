#! /usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import {
    BakeStepConfig,
    bakeSteps,
    SiteBaker,
    validateBakeSteps,
} from "./SiteBaker.js"
import * as fs from "fs-extra"
import { normalize } from "path"

const bakeDomainToFolder = async (
    baseUrl = "http://localhost:3000/",
    dir = "localBake",
    bakeSteps?: BakeStepConfig
) => {
    dir = normalize(dir)
    fs.mkdirp(dir)
    const baker = new SiteBaker(dir, baseUrl, bakeSteps)
    console.log(
        `Baking site sans Wordpress with baseUrl '${baseUrl}' to dir '${dir}'`
    )
    await baker.bakeNonWordpressPages()
}

yargs(hideBin(process.argv))
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
                    default: "localBake",
                    describe: "Directory to save the baked site",
                })
                .option("steps", {
                    type: "array",
                    choices: bakeSteps,
                    description: "Steps to perform during the baking process",
                })
        },
        async ({ baseUrl, dir, steps }) => {
            const typesafeSteps = validateBakeSteps(steps)
                ? new Set(steps)
                : undefined
            await bakeDomainToFolder(baseUrl, dir, typesafeSteps)
            process.exit(0)
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
