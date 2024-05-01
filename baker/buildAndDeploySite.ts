#! /usr/bin/env node

import { Deployer } from "./Deployer.js"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import os from "os"
import path from "path"
import { DeployTarget } from "./DeployTarget.js"

void yargs(hideBin(process.argv))
    .command<{
        target: DeployTarget
        skipChecks: boolean
        runChecksRemotely: boolean
        steps?: string[]
    }>(
        "$0 [target]",
        "Deploy the site to a remote environment",
        (yargs) => {
            yargs.boolean(["skip-checks", "run-checks-remotely"])
        },
        async ({ target, skipChecks, runChecksRemotely }) => {
            const deployer = new Deployer({
                target: target as any,
                userRunningTheDeploy: os.userInfo().username,
                owidGrapherRootDir: path.normalize(__dirname + "/../../"),
                skipChecks,
                runChecksRemotely: runChecksRemotely,
            })
            await deployer.buildAndDeploy()
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
