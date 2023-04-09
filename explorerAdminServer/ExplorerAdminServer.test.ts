#! /usr/bin/env jest
import { jest } from "@jest/globals"

jest.setTimeout(10000) // wait up to 10s

import { ExplorerAdminServer } from "./ExplorerAdminServer.js"
import url from "url"

it("can init", async () => {
    const server = new ExplorerAdminServer(
        url.fileURLToPath(new URL(".", import.meta.url))
    )
    expect(server).toBeTruthy()

    const allExplorersResult = await server.getAllExplorersCommand()
    expect(allExplorersResult.success).toBeTruthy()
})
