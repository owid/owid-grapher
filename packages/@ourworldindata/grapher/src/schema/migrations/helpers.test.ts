import { expect, it, describe } from "vitest"

import { formatGrapherSchemaUrl } from "@ourworldindata/utils"

import { latestSchemaVersion } from "../defaultGrapherConfig"
import { createSchemaForVersion, getSchemaVersion } from "./helpers"

describe(getSchemaVersion, () => {
    it("reads the version off a url without a revision", () => {
        expect(
            getSchemaVersion({
                $schema: formatGrapherSchemaUrl(latestSchemaVersion),
            })
        ).toEqual(latestSchemaVersion)
    })

    it("reads the version off a url with a revision", () => {
        expect(
            getSchemaVersion({
                $schema: formatGrapherSchemaUrl(latestSchemaVersion, 4),
            })
        ).toEqual(latestSchemaVersion)
    })

    it("returns null for a url naming an unknown version", () => {
        expect(
            getSchemaVersion({ $schema: formatGrapherSchemaUrl("999", 4) })
        ).toBeNull()
    })

    it("returns null for a schema hosted somewhere else", () => {
        expect(
            getSchemaVersion({
                $schema: `https://example.org/schemas/grapher-schema.${latestSchemaVersion}.json`,
            })
        ).toBeNull()
    })
})

describe(createSchemaForVersion, () => {
    it("builds the same url as the shared formatter", () => {
        expect(createSchemaForVersion(latestSchemaVersion)).toEqual(
            formatGrapherSchemaUrl(latestSchemaVersion)
        )
    })
})
