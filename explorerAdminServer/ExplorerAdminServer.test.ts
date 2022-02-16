#! /usr/bin/env jest

jest.setTimeout(10000) // wait up to 10s

import { ExplorerAdminServer } from "./ExplorerAdminServer.js"

it("can init", async () => {
    const server = new ExplorerAdminServer(__dirname)
    expect(server).toBeTruthy()

    const allExplorersResult = await server.getAllExplorersCommand()
    expect(allExplorersResult.success).toBeTruthy()
})
