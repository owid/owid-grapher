import { beforeEach, describe, expect, it } from "vitest"

import { PRODUCTION_FEED_ROOT, feedUrl, setFeedRoot } from "./feedUrl.js"

const FEED = "ihme_gbd/latest/gbd_treemap_json"

describe("feedUrl", () => {
    beforeEach(() => setFeedRoot(undefined))

    it("falls back to production when the page passes no root", () => {
        expect(feedUrl(FEED, "causes-of-death.metadata.json")).toBe(
            `${PRODUCTION_FEED_ROOT}/${FEED}/causes-of-death.metadata.json`
        )
    })

    it("uses the root the page passed", () => {
        setFeedRoot(
            "https://api-staging.owid.io/staging-site-my-branch/v1/bespoke"
        )
        expect(feedUrl(FEED, "causes-of-death.1.json")).toBe(
            "https://api-staging.owid.io/staging-site-my-branch/v1/bespoke/" +
                `${FEED}/causes-of-death.1.json`
        )
    })

    it("tolerates a trailing slash and blank values", () => {
        setFeedRoot("https://example.org/v1/bespoke/")
        expect(feedUrl(FEED, "x.json")).toBe(
            `https://example.org/v1/bespoke/${FEED}/x.json`
        )
        // An empty string is what an unset env var reaches the bundle as; production data beats
        // requests to the page's own origin.
        setFeedRoot("  ")
        expect(feedUrl(FEED, "x.json")).toBe(
            `${PRODUCTION_FEED_ROOT}/${FEED}/x.json`
        )
    })
})
