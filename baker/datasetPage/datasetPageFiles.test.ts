import { describe, expect, it } from "vitest"
import { parseDatasetPageKeys } from "./datasetPageFiles.js"

describe(parseDatasetPageKeys, () => {
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://catalog.ourworldindata.org/emissions/owid_co2/</loc>
    <lastmod>2026-11-10</lastmod>
  </url>
  <url>
    <loc>https://catalog.ourworldindata.org/energy/owid_energy/</loc>
  </url>
  <url>
    <loc>https://example.org/other/page/</loc>
  </url>
  <url>
    <loc>https://catalog.ourworldindata.org/too/many/parts/</loc>
  </url>
</urlset>`

    it("lists the datasets that have a page under the base address", () => {
        expect(
            parseDatasetPageKeys(sitemap, "https://catalog.ourworldindata.org/")
        ).toEqual(["emissions/owid_co2", "energy/owid_energy"])
    })

    it("finds nothing under another address", () => {
        expect(
            parseDatasetPageKeys(
                sitemap,
                "https://api-staging.owid.io/my-server/v1/dataset-pages"
            )
        ).toEqual([])
    })
})
