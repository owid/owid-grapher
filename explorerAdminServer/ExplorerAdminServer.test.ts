#! /usr/bin/env jest

jest.setTimeout(10000) // wait up to 10s

import { ExplorerProgram } from "../explorer/ExplorerProgram"
import { ExplorerAdminServer } from "./ExplorerAdminServer"

it("can init", async () => {
    const server = new ExplorerAdminServer(__dirname, "https://example.com")
    expect(server).toBeTruthy()

    expect(
        await server.renderExplorerPage(
            new ExplorerProgram("foo", "explorerTitle helloWorld")
        )
    ).toContain("helloWorld")

    const allExplorersResult = await server.getAllExplorersCommand()
    expect(allExplorersResult.success).toBeTruthy()
})
