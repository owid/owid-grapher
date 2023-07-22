#! /usr/bin/env jest

import { nodeDirname } from "@ourworldindata/utils"
import { SiteBaker } from "./SiteBaker.js"

it("can init", () => {
    const baker = new SiteBaker(
        nodeDirname(import.meta) + "/example.com",
        "https://example.com"
    )
    expect(baker).toBeTruthy()
})
