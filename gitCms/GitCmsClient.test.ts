#! /usr/bin/env jest

import { GitCmsClient } from "./GitCmsClient.js"

// Just some sanity tests, main tests are in the integration tests file.

it("can init", () => {
    expect(new GitCmsClient("")).toBeTruthy()
})

it("validates input", async () => {
    try {
        await new GitCmsClient("").deleteRemoteFile({ filepath: "foo~bar" })
    } catch (err) {
        expect(err).toBeTruthy()
    }
})
