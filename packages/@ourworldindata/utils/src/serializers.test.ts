import { expect, it, describe } from "vitest"

import { deserializeJSONFromHTML, serializeJSONForHTML } from "./serializers.js"

describe("encode and decode json", () => {
    it("should encode and decode an object correctly", async () => {
        const cases = [0, { foo: "bar" }, 2, false, { test: { nesting: 2 } }]
        cases.forEach((testCase) => {
            expect(
                deserializeJSONFromHTML(
                    `<html>${serializeJSONForHTML(testCase)}</html>`
                )
            ).toEqual(testCase)
        })

        expect(
            deserializeJSONFromHTML(
                `<html>${serializeJSONForHTML(undefined)}</html>`
            )
        ).toEqual(undefined)
    })
})
