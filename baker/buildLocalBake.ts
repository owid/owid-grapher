#! /usr/bin/env node

import parseArgs from "minimist"
import {
    BakeStep,
    BakeStepConfig,
    bakeSteps,
    SiteBaker,
    validateBakeSteps,
} from "./SiteBaker.js"
import * as fs from "fs-extra"
import { normalize } from "path"
import { difference } from "lodash"

const bakeDomainToFolder = async (
    baseUrl = "http://localhost:3000/",
    dir = "localBake",
    bakeSteps?: Partial<BakeStepConfig>
) => {
    dir = normalize(dir)
    fs.mkdirp(dir)
    const baker = new SiteBaker(dir, baseUrl, bakeSteps)
    console.log(
        `Baking site sans Wordpress with baseUrl '${baseUrl}' to dir '${dir}'`
    )
    await baker.bakeNonWordpressPages()
}

const args = parseArgs(process.argv.slice(2))
const positionalArgs = args._
const steps: string[] | undefined = args?.steps?.split(",")
let stepsConfig: Partial<BakeStepConfig> | undefined = undefined

if (steps) {
    if (validateBakeSteps(steps)) {
        stepsConfig = steps.reduce(
            (acc, step) => ({ ...acc, [step]: true }),
            {}
        )
    } else {
        new Error(
            `Invalid step(s) passed to buildLocalBake: ${difference(
                steps,
                bakeSteps
            )}`
        )
    }
}
// Usage: yarn buildLocalBake http://localhost:3000/ localBake --steps gdocs,assets
// todo: can we just make all paths relative? why do we need absolute baked base url?
bakeDomainToFolder(positionalArgs[0], positionalArgs[1], stepsConfig).then(
    (_) => {
        // TODO: without this the script hangs here since using the workerpool library in baking
        // I don't understand why this happens. Probably using top level await would also resolve
        // this but I couldn't get Typescript to play along with that
        process.exit(0)
    }
)
