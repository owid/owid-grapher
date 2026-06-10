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

    it("should escape inline-script breaking content", () => {
        const payload = {
            title: "</script><script>alert(1)</script>",
            text: "line separator:  and paragraph separator: ",
        }

        const serialized = serializeJSONForHTML(payload)

        expect(serialized).not.toContain("</script>")
        expect(serialized).toContain("\\u003c/script>")
        expect(serialized).toContain("\\u2028")
        expect(serialized).toContain("\\u2029")
        expect(deserializeJSONFromHTML(`<html>${serialized}</html>`)).toEqual(
            payload
        )
    })
})
