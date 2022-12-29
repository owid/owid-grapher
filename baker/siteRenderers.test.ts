#! /usr/bin/env jest
import { it, describe, expect, test } from "vitest"

import {} from "../site/blocks/ProminentLink.js"
import { renderExplorerPage } from "./siteRenderers.js"
import { ExplorerProgram } from "../explorer/ExplorerProgram.js"

// Note: renderProminentLinks() tests are now e2e (see kitchenSink.js)

it("renders an explorer page with title", async () => {
    expect(
        await renderExplorerPage(
            new ExplorerProgram("foo", "explorerTitle helloWorld")
        )
    ).toContain("helloWorld")
})
