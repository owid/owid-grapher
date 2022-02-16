#! /usr/bin/env jest

import { GitCmsServer } from "./GitCmsServer.js"

// Just a sanity test, main tests are in the integration tests file.
it("can init", () => {
    expect(new GitCmsServer({ baseDir: __dirname })).toBeTruthy()
})
