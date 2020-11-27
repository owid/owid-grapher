#! /usr/bin/env yarn jest

import { deserializeJSONFromHTML, serializeJSONForHTML } from "./serializers"

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
