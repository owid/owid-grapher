// todo: remove this file

import { bake } from "./DeployUtils.js"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { bakeSteps, validateBakeSteps } from "./SiteBaker.js"

yargs(hideBin(process.argv))
    .command<{
        steps?: string[]
    }>(
        "$0",
        "Deploy the site to a remote environment",
        (yargs) => {
            yargs.option("steps", {
                type: "array",
                choices: bakeSteps,
                description: "Steps to perform during the baking process",
            })
        },
        async ({ steps }) => {
            const bakeSteps = validateBakeSteps(steps)
                ? new Set(steps)
                : undefined
            bake(bakeSteps).then((_) => {
                // TODO: without this the script hangs here since using the workerpool library in baking
                // I don't understand why this happens. Probably using top level await would also resolve
                // this but I couldn't get Typescript to play along with that
                process.exit(0)
            })
        }
    )
    .strict().argv
