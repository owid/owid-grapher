#! /usr/bin/env jest

import {} from "../site/blocks/ProminentLink.js"
import { renderExplorerPage } from "./siteRenderers.js"
import { ExplorerProgram } from "../explorer/ExplorerProgram.js"
import { Knex } from "knex"

// Note: renderProminentLinks() tests are now e2e (see kitchenSink.js)

it("renders an explorer page with title", async () => {
    const knex: Knex = {} as Knex

    expect(
        await renderExplorerPage(
            new ExplorerProgram("foo", "explorerTitle helloWorld"),
            knex
        )
    ).toContain("helloWorld")
})
