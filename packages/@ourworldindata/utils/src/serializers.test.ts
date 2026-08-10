import { expect, it, describe } from "vitest"

import {
    deserializeJSONFromHTML,
    serializeJSONForHTML,
    serializeJSONForInlineScript,
} from "./serializers.js"

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

describe("serializing JSON into an inline script", () => {
    // These payloads reach inline scripts from free-text fields (dataset owners, gdoc
    // content, chart config), so a `</script>` in the data must not close the tag.
    it("escapes content that would break out of an inline script", () => {
        const payload = {
            title: "</script><script>alert(1)</script>",
            text: "separators: \u2028 and \u2029",
        }

        const serialized = serializeJSONForInlineScript(payload)

        expect(serialized).not.toContain("</script>")
        expect(serialized).toContain("\\u003c/script>")
        expect(serialized).toContain("\\u2028")
        expect(serialized).toContain("\\u2029")
        // Still valid JS: evaluating the assignment recovers the original object.
        expect(JSON.parse(serialized)).toEqual(payload)
    })

    it("stays compact, unlike serializeJSONForHTML", () => {
        const payload = { a: 1, nested: { b: 2, c: [3, 4] } }

        expect(serializeJSONForInlineScript(payload)).toBe(
            JSON.stringify(payload)
        )
        expect(serializeJSONForInlineScript(payload).length).toBeLessThan(
            serializeJSONForHTML(payload).length
        )
    })
})
