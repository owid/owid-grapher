import { describe, expect, it } from "vitest"
import { getLinkedDocumentUrl, isExternalUrl } from "./utils.js"
import { ContentGraphLinkType, OwidGdocType } from "@ourworldindata/types"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"

describe(isExternalUrl, () => {
    it("returns false when the link type is not a URL", () => {
        expect(
            isExternalUrl(ContentGraphLinkType.Gdoc, "https://example.com")
        ).toBe(false)
    })

    it("returns false for URLs on the baked origin", () => {
        expect(
            isExternalUrl(ContentGraphLinkType.Url, `${BAKED_BASE_URL}/data`)
        ).toBe(false)
    })

    it("returns false for relative URLs", () => {
        expect(isExternalUrl(ContentGraphLinkType.Url, "/data")).toBe(false)
    })

    it("returns true for external URLs", () => {
        expect(
            isExternalUrl(ContentGraphLinkType.Url, "https://example.com/data")
        ).toBe(true)
    })

    it("returns false when link origin cannot be determined", () => {
        expect(isExternalUrl(ContentGraphLinkType.Url, "not-a-valid-url")).toBe(
            false
        )
    })
})

describe(getLinkedDocumentUrl, () => {
    it("appends the fragment from the original gdoc URL to the canonical URL", () => {
        const url = getLinkedDocumentUrl(
            { slug: "a-slug", type: OwidGdocType.Article },
            "https://docs.google.com/document/d/abcd/edit#my-heading",
            "https://ourworldindata.org"
        )
        expect(url).toBe("https://ourworldindata.org/a-slug#my-heading")
    })

    it("returns the canonical URL when no fragment is provided", () => {
        const url = getLinkedDocumentUrl(
            { slug: "a-slug", type: OwidGdocType.Article },
            "https://docs.google.com/document/d/abcd/edit",
            "https://ourworldindata.org"
        )
        expect(url).toBe("https://ourworldindata.org/a-slug")
    })
})
