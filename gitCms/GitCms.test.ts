#! /usr/bin/env jest

import { GitCmsClient } from "./GitCmsClient"
import { GitCmsServer } from "./GitCmsServer"
import { removeSync } from "fs-extra"

describe("gitCms integration tests", () => {
    const folder = __dirname + "/integrationTestTempDirectoryOkToDelete"

    it("can init instances", async () => {
        try {
            const server = new GitCmsServer(folder)

            await server.createDirAndInitIfNeeded()
            expect(server).toBeTruthy()

            const client = new GitCmsClient()
        } catch (err) {
            console.error(err)
        } finally {
            removeSync(folder)
        }
    })
})
