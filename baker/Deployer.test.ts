#! /usr/bin/env jest

import { Deployer } from "./Deployer.js"
import { DeployTarget } from "./DeployTarget.js"

import { dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

it("can init", () => {
    const deployer = new Deployer({
        owidGrapherRootDir: __dirname + "/../",
        target: DeployTarget.live,
        userRunningTheDeploy: "jane",
        skipChecks: true,
        runChecksRemotely: false,
    })
    expect(deployer.targetIsProd).toBeTruthy()
})
