#! /usr/bin/env jest

import { Deployer } from "./Deployer"
import { DeployTarget } from "./DeployTarget"

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
