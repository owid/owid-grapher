#! /usr/bin/env jest

import { ExplorerAdminServer } from "./ExplorerAdminServer"

it("can init", () => {
    const server = new ExplorerAdminServer(__dirname, "https://example.com")
    expect(server).toBeTruthy()
})
