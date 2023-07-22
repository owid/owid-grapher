#! /usr/bin/env jest

import { nodeDirname } from "@ourworldindata/utils"
import { Deployer } from "./Deployer.js"
import { DeployTarget } from "./DeployTarget.js"

it("can init", () => {
    const deployer = new Deployer({
        owidGrapherRootDir: nodeDirname(import.meta) + "/../",
        target: DeployTarget.live,
        userRunningTheDeploy: "jane",
        skipChecks: true,
        runChecksRemotely: false,
    })
    expect(deployer.targetIsProd).toBeTruthy()
})
