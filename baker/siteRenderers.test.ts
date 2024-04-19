#! /usr/bin/env jest

import {} from "../site/blocks/ProminentLink.js"
import { renderExplorerPage } from "./siteRenderers.js"
import { ExplorerProgram } from "../explorer/ExplorerProgram.js"
import { KnexReadonlyTransaction } from "../db/db.js"

// Note: renderProminentLinks() tests are now e2e (see kitchenSink.js)

it("renders an explorer page with title", async () => {
    const knex: KnexReadonlyTransaction = {} as KnexReadonlyTransaction

    expect(
        await renderExplorerPage(
            new ExplorerProgram("foo", "explorerTitle helloWorld"),
            knex
        )
    ).toContain("helloWorld")
})
