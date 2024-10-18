#! yarn testJest

import { Url } from "@ourworldindata/utils"
import {
    explorerUrlMigrationsById,
    ExplorerUrlMigrationId,
    migrateExplorerUrl,
} from "./ExplorerUrlMigrations.js"

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
        "https://ourworldindata.org/coronavirus-data-explorer?country=ESP~MKD~North+America"
    )
    const baseQueryStr = "country=SWE~MKD&yScale=log&year=0"
    const migratedUrl = migration.migrateUrl(legacyUrl, baseQueryStr)
    const migratedQueryParams = migratedUrl.queryParams

    it("has correct explorer slug", () => {
        expect(migration.explorerSlug).toEqual("coronavirus-data-explorer")
    })

    it("sets new pathname", () => {
        expect(migratedUrl.pathname).toEqual(
            "/explorers/coronavirus-data-explorer"
        )
    })

    it("migrates country param correctly", () => {
        expect(migratedQueryParams.country).toEqual("ESP~MKD~North America")
    })

    it("migrates year param correctly", () => {
        expect(migratedQueryParams.year).toBeUndefined()
        expect(migratedQueryParams.time).toEqual("0")
    })

    it("preserves old query params", () => {
        expect(migratedQueryParams.yScale).toEqual("log")
    })

    it("sets boolean options to 'false' if omitted in legacy URL", () => {
        const legacyUrl = Url.fromURL(
            "https://ourworldindata.org/coronavirus-data-explorer?casesMetric=true"
        )
        const baseQueryStr = "deathsMetric=true&perCapita=true&aligned=true"
        const migratedUrl = migration.migrateUrl(legacyUrl, baseQueryStr)
        const migratedQueryParams = migratedUrl.queryParams

        expect(migratedQueryParams["Metric"]).toEqual("Confirmed cases")
        expect(migratedQueryParams["Relative to Population"]).toEqual("false")
        expect(migratedQueryParams["Align outbreaks"]).toEqual("false")
    })

    it("sets default view for legacy URL without params", () => {
        const legacyUrl = Url.fromURL(
            "https://ourworldindata.org/coronavirus-data-explorer"
        )
        const baseQueryStr = "casesMetric=true&interval=daily&perCapita=true"
        const migratedUrl = migration.migrateUrl(legacyUrl, baseQueryStr)
        const migratedQueryParams = migratedUrl.queryParams

        expect(migratedQueryParams["Metric"]).toEqual("Confirmed cases")
        expect(migratedQueryParams["Relative to Population"]).toEqual("true")
        expect(migratedQueryParams["Align outbreaks"]).toEqual("false")
    })
})

describe("co2 explorer", () => {
    const legacyUrl = Url.fromURL(
        "https://ourworldindata.org/explorers/co2?tab=chart&xScale=linear&yScale=linear&stackMode=absolute&time=earliest..latest&country=China~United%20States~India~United%20Kingdom~World&Gas%20=CO%E2%82%82&Accounting%20=Production-based&Fuel%20=Coal&Count%20=Cumulative&Relative%20to%20world%20total%20=Share%20of%20global%20emissions"
    )
    const migratedUrl = migrateExplorerUrl(legacyUrl)

    it("generates correct query params", () => {
        expect(migratedUrl.queryParams).toEqual({
            Accounting: "Production-based",
            Count: "Cumulative",
            Fuel: "Coal",
            Gas: "CO₂",
            "Relative to world total": "true",
            country: "China~United States~India~United Kingdom~World",
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

    it("generates correct query params", () => {
        expect(migratedUrl.queryParams).toEqual({
            "Energy or Electricity": "Electricity only",
            Metric: "Per capita generation",
            "Select a source": "Fossil fuels",
            "Total or Breakdown": "Select a source",
            country:
                "United States~United Kingdom~China~World~India~Brazil~South Africa",
            tab: "chart",
            time: "earliest..latest",
            xScale: "linear",
            yScale: "linear",
        })
    })
})

describe("covid explorer", () => {
    it("migrates Vaccinations", () => {
        const legacyUrl = Url.fromURL(
            "https://ourworldindata.org/explorers/coronavirus-data-explorer?Metric=Vaccinations"
        )
        const migratedUrl = migrateExplorerUrl(legacyUrl)
        expect(migratedUrl.queryParams).toMatchObject({
            Metric: "Vaccine doses",
        })
    })
    it("migrates Tests per confirmed case", () => {
        const legacyUrl = Url.fromURL(
            "https://ourworldindata.org/explorers/coronavirus-data-explorer?Metric=Tests+per+confirmed+case"
        )
        const migratedUrl = migrateExplorerUrl(legacyUrl)
        expect(migratedUrl.queryParams).toMatchObject({
            Metric: "Tests per case",
        })
    })
})
