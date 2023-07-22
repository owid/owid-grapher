#! /usr/bin/env jest
import { jest } from "@jest/globals"

jest.setTimeout(10000) // wait up to 10s

import { ExplorerAdminServer } from "./ExplorerAdminServer.js"
import { nodeDirname } from "@ourworldindata/utils"

it("can init", async () => {
    const server = new ExplorerAdminServer(nodeDirname(import.meta))
    expect(server).toBeTruthy()

    const allExplorersResult = await server.getAllExplorersCommand()
    expect(allExplorersResult.success).toBeTruthy()
})
