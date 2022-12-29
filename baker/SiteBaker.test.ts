#! /usr/bin/env jest
import { it, describe, expect, test } from "vitest"

import { SiteBaker } from "./SiteBaker.js"

it("can init", () => {
    const baker = new SiteBaker(
        __dirname + "/example.com",
        "https://example.com"
    )
    expect(baker).toBeTruthy()
})
