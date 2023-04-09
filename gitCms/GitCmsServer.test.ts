#! /usr/bin/env jest

import { GitCmsServer } from "./GitCmsServer.js"
import url from "url"

// Just a sanity test, main tests are in the integration tests file.
it("can init", () => {
    expect(
        new GitCmsServer({
            baseDir: url.fileURLToPath(new URL(".", import.meta.url)),
        })
    ).toBeTruthy()
})
