#! /usr/bin/env jest
import { it, describe, expect, test } from "vitest"

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
