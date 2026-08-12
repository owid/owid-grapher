import { expect, it, describe } from "vitest"

import { injectHtmlBeforeTitle } from "./siteRenderers.js"

describe(injectHtmlBeforeTitle, () => {
    it("injects the snippet directly before the <title> tag", () => {
        const html =
            '<!doctype html><html><head><meta name="viewport" content="width=device-width"/><title>My page</title></head><body></body></html>'
        expect(injectHtmlBeforeTitle(html, "<script>1</script>")).toBe(
            '<!doctype html><html><head><meta name="viewport" content="width=device-width"/><script>1</script><title>My page</title></head><body></body></html>'
        )
    })

    it("anchors on the head's title, not an SVG <title> in the body", () => {
        const html =
            "<html><head><title>Page</title></head><body><svg><title>Icon</title></svg></body></html>"
        expect(injectHtmlBeforeTitle(html, "<script>1</script>")).toBe(
            "<html><head><script>1</script><title>Page</title></head><body><svg><title>Icon</title></svg></body></html>"
        )
    })

    it("doesn't anchor on tags merely starting with 'title'", () => {
        const html =
            "<html><head><titlefoo>nope</titlefoo><title>Page</title></head><body></body></html>"
        expect(injectHtmlBeforeTitle(html, "<x/>")).toBe(
            "<html><head><titlefoo>nope</titlefoo><x/><title>Page</title></head><body></body></html>"
        )
    })

    it("throws when the page has no <title> tag", () => {
        expect(() =>
            injectHtmlBeforeTitle(
                "<html><head></head><body></body></html>",
                "<x/>"
            )
        ).toThrow("no <title> tag found")
    })
})
