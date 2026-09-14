import { expect, it, describe } from "vitest"

import { latestSchemaVersion } from "../defaultGrapherConfig"
import { getSchemaRevision, getSchemaVersion } from "./helpers"

const urlForVersion = (version: string): string =>
    `https://files.ourworldindata.org/schemas/grapher-schema.${version}.json`

describe(getSchemaVersion, () => {
    it("reads the version off a url without a revision", () => {
        expect(
            getSchemaVersion({ $schema: urlForVersion(latestSchemaVersion) })
        ).toEqual(latestSchemaVersion)
    })

    it("reads the version off a url with a revision", () => {
        expect(
            getSchemaVersion({
                $schema: urlForVersion(`${latestSchemaVersion}.04`),
            })
        ).toEqual(latestSchemaVersion)
    })

    it("returns null for a url naming an unknown version", () => {
        expect(
            getSchemaVersion({ $schema: urlForVersion("999.04") })
        ).toBeNull()
    })
})

describe(getSchemaRevision, () => {
    it("returns undefined for a url without a revision", () => {
        expect(
            getSchemaRevision({ $schema: urlForVersion(latestSchemaVersion) })
        ).toBeUndefined()
    })

    it("returns undefined for a config without a $schema", () => {
        expect(getSchemaRevision({ title: "Test" })).toBeUndefined()
    })

    it("reads a zero-padded revision as a number", () => {
        expect(
            getSchemaRevision({
                $schema: urlForVersion(`${latestSchemaVersion}.04`),
            })
        ).toEqual(4)
    })

    it("rejects a revision that isn't two digits", () => {
        expect(
            getSchemaRevision({
                $schema: urlForVersion(`${latestSchemaVersion}.4`),
            })
        ).toBeUndefined()
    })
})
