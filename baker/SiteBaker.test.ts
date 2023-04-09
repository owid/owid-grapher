#! /usr/bin/env jest

import { SiteBaker } from "./SiteBaker.js"
import url from "url"

it("can init", () => {
    const baker = new SiteBaker(
        url.fileURLToPath(new URL(".", import.meta.url)) + "/example.com",
        "https://example.com"
    )
    expect(baker).toBeTruthy()
})
