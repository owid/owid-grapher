#! /usr/bin/env jest

import { Deployer } from "./Deployer.js"
import { DeployTarget } from "./DeployTarget.js"
import url from "url"

it("can init", () => {
    const deployer = new Deployer({
        owidGrapherRootDir:
            url.fileURLToPath(new URL(".", import.meta.url)) + "/../",
        target: DeployTarget.live,
        userRunningTheDeploy: "jane",
        skipChecks: true,
        runChecksRemotely: false,
    })
    expect(deployer.targetIsProd).toBeTruthy()
})
