#! /usr/bin/env jest

import { GitCmsClient } from "./GitCmsClient"

it("can init", () => {
    expect(new GitCmsClient()).toBeTruthy()
})

it("validates input", async () => {
    try {
        await new GitCmsClient().deleteRemoteFile({ filepath: "foo~bar" })
    } catch (err) {
        expect(err).toBeTruthy()
    }
})
