#! /usr/bin/env jest

import { Deployer } from "./Deployer"

it("can init", () => {
    const deployer = new Deployer({
        owidGrapherRootDir: __dirname + "/../",
        target: "live" as any,
        userRunningTheDeploy: "jane",
        skipChecks: true,
        runChecksRemotely: false,
    })
    expect(deployer.targetIsProd).toBeTruthy()
})
