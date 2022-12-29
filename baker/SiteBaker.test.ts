#! /usr/bin/env jest
import { it, describe, expect, test } from "vitest"

import { SiteBaker } from "./SiteBaker.js"

import { dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

it("can init", () => {
    const baker = new SiteBaker(
        __dirname + "/example.com",
        "https://example.com"
    )
    expect(baker).toBeTruthy()
})
