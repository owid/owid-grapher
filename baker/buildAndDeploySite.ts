#! /usr/bin/env node

import { Deployer } from "./Deployer"
import parseArgs from "minimist"
import os from "os"
import * as path from "path"

const parsedArgs = parseArgs(process.argv.slice(2))

const deployer = new Deployer({
    target: parsedArgs["_"][0] as any,
    userRunningTheDeploy: os.userInfo().username,
    owidGrapherRootDir: path.normalize(__dirname + "/../../"),
    skipChecks: parsedArgs["skip-checks"] === true,
    runChecksRemotely: parsedArgs["r"] === true,
})

deployer.buildAndDeploy()
