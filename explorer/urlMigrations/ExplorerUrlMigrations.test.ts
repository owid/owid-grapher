#! yarn testJest

import { Patch } from "../../patch/Patch"
import { Url } from "../../urls/Url"
import {
    explorerUrlMigrationsById,
    ExplorerUrlMigrationId,
    migrateExplorerUrl,
} from "./ExplorerUrlMigrations"

// ================================================
// !!! BE CAREFUL WHEN MODIFYING EXISTING TESTS !!!
// ================================================
//
// When any of these tests break, in all likelihood, we are
// also breaking some existing URLs pointing to us.
//
// Make sure to add redirects when making changes.
//

describe("legacyToGridCovidExplorer", () => {
    const migration =
        explorerUrlMigrationsById[
            ExplorerUrlMigrationId.legacyToGridCovidExplorer
        ]

    const legacyUrl = Url.fromURL(
        "https://ourworldindata.org/coronavirus-data-explorer?country=ESP~MKD"
    )
    const baseQueryStr = "country=SWE~MKD&yScale=log&year=0"
    const migratedUrl = migration.migrateUrl(legacyUrl, baseQueryStr)
    const migratedPatch = new Patch(migratedUrl.queryParams.patch)

    it("has correct explorer slug", () => {
        expect(migration.explorerSlug).toEqual("coronavirus-data-explorer")
    })

    it("sets new pathname", () => {
        expect(migratedUrl.pathname).toEqual(
            "/explorers/coronavirus-data-explorer"
        )
    })

    it("only contains patch param", () => {
        expect(Object.keys(migratedUrl.queryParams)).toEqual(["patch"])
    })

    it("migrates country param correctly", () => {
        expect(migratedPatch.object.country).toBeUndefined()
        expect(migratedPatch.object.selection).toEqual([
            "Spain",
            "North Macedonia",
        ])
    })

    it("migrates year param correctly", () => {
        expect(migratedPatch.object.year).toBeUndefined()
        expect(migratedPatch.object.time).toEqual("0")
    })

    it("preserves old query params", () => {
        expect(migratedPatch.object.yScale).toEqual("log")
    })
})

describe("co2 explorer", () => {
    const legacyUrl = Url.fromURL(
        "https://ourworldindata.org/explorers/co2?tab=chart&xScale=linear&yScale=linear&stackMode=absolute&time=earliest..latest&country=China~United%20States~India~United%20Kingdom~World&Gas%20=CO%E2%82%82&Accounting%20=Production-based&Fuel%20=Coal&Count%20=Cumulative&Relative%20to%20world%20total%20=Share%20of%20global%20emissions"
    )
    const migratedUrl = migrateExplorerUrl(legacyUrl)

    it("generates correct patch param", () => {
        const patch = new Patch(migratedUrl.queryParams.patch)
        expect(patch.object).toEqual({
            "Accounting Radio": "Production-based",
            "Count Dropdown": "Cumulative",
            "Fuel Dropdown": "Coal",
            "Gas Radio": "CO₂",
            "Relative to world total Checkbox": "true",
            selection: [
                "China",
                "United States",
                "India",
                "United Kingdom",
                "World",
            ],
            stackMode: "absolute",
            tab: "chart",
            time: "earliest..latest",
            xScale: "linear",
            yScale: "linear",
        })
    })
})

describe("energy explorer", () => {
    const legacyUrl = Url.fromURL(
        "https://ourworldindata.org/explorers/energy?tab=chart&xScale=linear&yScale=linear&time=earliest..latest&country=United%20States~United%20Kingdom~China~World~India~Brazil~South%20Africa&Total%20or%20Breakdown%20=Select%20a%20source&Select%20a%20source%20=Fossil%20fuels&Energy%20or%20Electricity%20=Electricity%20only&Metric%20=Per%20capita%20generation"
    )
    const migratedUrl = migrateExplorerUrl(legacyUrl)

    it("generates correct patch param", () => {
        const patch = new Patch(migratedUrl.queryParams.patch)
        expect(patch.object).toEqual({
            "Energy or Electricity Radio": "Electricity only",
            "Metric Dropdown": "Per capita generation",
            "Select a source Dropdown": "Fossil fuels",
            "Total or Breakdown Radio": "Select a source",
            selection: [
                "United States",
                "United Kingdom",
                "China",
                "World",
                "India",
                "Brazil",
                "South Africa",
            ],
            tab: "chart",
            time: "earliest..latest",
            xScale: "linear",
            yScale: "linear",
        })
    })
})
