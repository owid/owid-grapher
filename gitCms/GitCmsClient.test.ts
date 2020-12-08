#! /usr/bin/env jest

import { GitCmsClient } from "./GitCmsClient"

it("can init", () => {
    expect(new GitCmsClient()).toBeTruthy()
})
