import { describe, expect, it } from "vitest"

import {
    formatGrapherSchemaFileName,
    formatGrapherSchemaUrl,
    parseGrapherSchemaName,
} from "./grapherSchemaName.js"

describe(parseGrapherSchemaName, () => {
    it("reads a url without a revision", () => {
        expect(
            parseGrapherSchemaName(
                "https://files.ourworldindata.org/schemas/grapher-schema.011.json"
            )
        ).toEqual({ version: "011", revision: undefined })
    })

    it("reads a url with a revision", () => {
        expect(
            parseGrapherSchemaName(
                "https://files.ourworldindata.org/schemas/grapher-schema.011.04.json"
            )
        ).toEqual({ version: "011", revision: 4 })
    })

    it("reads a bare file name", () => {
        expect(parseGrapherSchemaName("grapher-schema.011.00.json")).toEqual({
            version: "011",
            revision: 0,
        })
    })

    it("returns undefined for the .latest alias, which names no version", () => {
        expect(
            parseGrapherSchemaName("grapher-schema.latest.json")
        ).toBeUndefined()
    })

    it("returns undefined for any other name", () => {
        for (const name of [
            "grapher-schema.011.yaml",
            "grapher-schema.011.4.json",
            "grapher-schema.json",
            "https://files.ourworldindata.org/schemas/grapher-schema.011.json?v=2",
        ])
            expect(parseGrapherSchemaName(name)).toBeUndefined()
    })
})

describe(formatGrapherSchemaFileName, () => {
    it("pads the revision to two digits", () => {
        expect(formatGrapherSchemaFileName("011", 4)).toEqual(
            "grapher-schema.011.04.json"
        )
    })

    it("round-trips through parseGrapherSchemaName", () => {
        for (const revision of [undefined, 0, 4, 12]) {
            const fileName = formatGrapherSchemaFileName("011", revision)
            expect(parseGrapherSchemaName(fileName)).toEqual({
                version: "011",
                revision,
            })
        }
    })
})

describe(formatGrapherSchemaUrl, () => {
    it("builds the full schema url", () => {
        expect(formatGrapherSchemaUrl("011", 4)).toEqual(
            "https://files.ourworldindata.org/schemas/grapher-schema.011.04.json"
        )
    })
})
