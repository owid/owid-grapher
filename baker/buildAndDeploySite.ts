#! /usr/bin/env node

import { Deployer } from "./Deployer.js"
import parseArgs from "minimist"
import os from "os"
import * as path from "path"

import { dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const parsedArgs = parseArgs(process.argv.slice(2))

const deployer = new Deployer({
    target: parsedArgs["_"][0] as any,
    userRunningTheDeploy: os.userInfo().username,
    owidGrapherRootDir: path.normalize(__dirname + "/../../"),
    skipChecks: parsedArgs["skip-checks"] === true,
    runChecksRemotely: parsedArgs["r"] === true,
})

deployer.buildAndDeploy()
