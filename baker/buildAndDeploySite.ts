#! /usr/bin/env node

import { Deployer } from "./Deployer.js"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import os from "os"
import path from "path"
import { BakeStep, bakeSteps } from "./SiteBaker.js"
import { DeployTarget } from "./DeployTarget.js"
import { nodeDirname } from "@ourworldindata/utils"

yargs(hideBin(process.argv))
    .command<{
        target: DeployTarget
        skipChecks: boolean
        runChecksRemotely: boolean
        steps?: string[]
    }>(
        "$0 [target]",
        "Deploy the site to a remote environment",
        (yargs) => {
            yargs
                .boolean(["skip-checks", "run-checks-remotely"])
                .option("steps", {
                    type: "array",
                    choices: bakeSteps,
                    description: "Steps to perform during the baking process",
                })
        },
        async ({ target, skipChecks, runChecksRemotely, steps }) => {
            const bakeSteps = steps ? new Set(steps as BakeStep[]) : undefined
            const deployer = new Deployer({
                target: target as any,
                userRunningTheDeploy: os.userInfo().username,
                owidGrapherRootDir: path.normalize(
                    nodeDirname(import.meta) + "/../../"
                ),
                skipChecks,
                runChecksRemotely: runChecksRemotely,
                bakeSteps,
            })
            await deployer.buildAndDeploy()
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
