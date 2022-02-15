#! /usr/bin/env jest
import { jest } from "@jest/globals"

jest.setTimeout(10000) // wait up to 10s

import { ExplorerAdminServer } from "./ExplorerAdminServer.js"

import { dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

it("can init", async () => {
    const server = new ExplorerAdminServer(__dirname)
    expect(server).toBeTruthy()

    const allExplorersResult = await server.getAllExplorersCommand()
    expect(allExplorersResult.success).toBeTruthy()
})
