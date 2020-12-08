#! /usr/bin/env jest

import { GitCmsServer } from "./GitCmsServer"

it("can init", () => {
    expect(new GitCmsServer(__dirname)).toBeTruthy()
})
