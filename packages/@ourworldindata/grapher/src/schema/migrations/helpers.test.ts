import { expect, it, describe } from "vitest"

import { latestSchemaVersion } from "../defaultGrapherConfig"
import { getSchemaVersion } from "./helpers"

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
