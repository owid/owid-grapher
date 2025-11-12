import { describe, expect, it } from "vitest"
import { ContentGraphLinkType } from "@ourworldindata/types"
import { isExternalUrl } from "./utils.js"
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
