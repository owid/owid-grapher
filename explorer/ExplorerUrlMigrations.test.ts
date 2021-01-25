#! yarn testJest

import { Patch } from "../patch/Patch"
import { Url } from "../urls/Url"
import {
    explorerUrlMigrationsById,
    ExplorerUrlMigrationId,
} from "./ExplorerUrlMigrations"

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
