#! /usr/bin/env jest
import { it, describe, expect, test } from "vitest"

import { GitCmsServer } from "./GitCmsServer.js"

import { dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Just a sanity test, main tests are in the integration tests file.
it("can init", () => {
    expect(new GitCmsServer({ baseDir: __dirname })).toBeTruthy()
})
