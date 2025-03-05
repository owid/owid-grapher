import { expect, it } from "vitest"

import { ExplorerAdminServer } from "./ExplorerAdminServer.js"

it("can init", { timeout: 10000 }, async () => {
    const server = new ExplorerAdminServer(__dirname)
    expect(server).toBeTruthy()

    const allExplorersResult = await server.getAllExplorersCommand()
    expect(allExplorersResult.success).toBeTruthy()
})
