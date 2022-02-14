#! /usr/bin/env jest

import { Deployer } from "./Deployer.js"
import { DeployTarget } from "./DeployTarget.js"

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
