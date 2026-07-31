import { describe, expect, it } from "vitest"
import { OwidGdocType } from "@ourworldindata/types"
import {
    getCanonicalPath,
    getSameSitePathFromUrl,
    getSlugCandidatesForCanonicalPath,
    PREVIEWABLE_GDOC_TYPES,
} from "./GdocsUtils.js"

const PROD = "https://ourworldindata.org"
// what a branch preview or staging deploy is baked onto
const PREVIEW = "https://pr-1234.owid.pages.dev"
const SAME_SITE_ORIGINS = [PROD, PREVIEW]

describe(getSlugCandidatesForCanonicalPath, () => {
    it("treats a top-level path as an article-style slug", () => {
        expect(getSlugCandidatesForCanonicalPath("/life-expectancy")).toEqual([
            "life-expectancy",
        ])
    })

    it("keeps a slug that contains a slash intact", () => {
        // real example: the article at /sdgs/no-poverty
        expect(getSlugCandidatesForCanonicalPath("/sdgs/no-poverty")).toEqual([
            "sdgs/no-poverty",
        ])
    })

    it.each([
        ["/team/hannah-ritchie", "team/hannah-ritchie", "hannah-ritchie"],
        ["/profile/energy", "profile/energy", "energy"],
    ])(
        "offers both the prefixed and unprefixed reading of %s",
        (path, full, unprefixed) => {
            expect(getSlugCandidatesForCanonicalPath(path)).toEqual([
                full,
                unprefixed,
            ])
        }
    )

    it("does not treat the data-insights prefix as a candidate, since data insights are not previewable", () => {
        expect(
            getSlugCandidatesForCanonicalPath("/data-insights/some-insight")
        ).toEqual(["data-insights/some-insight"])
    })

    it("offers no candidate for a bare prefix with no slug after it", () => {
        expect(getSlugCandidatesForCanonicalPath("/team")).toEqual(["team"])
        expect(getSlugCandidatesForCanonicalPath("/team/")).toEqual(["team/"])
    })

    it.each(["", "/", "life-expectancy"])(
        "returns no candidates for %j",
        (path) => {
            expect(getSlugCandidatesForCanonicalPath(path)).toEqual([])
        }
    )

    // Guards against CANONICAL_PATH_PREFIXES drifting away from
    // getCanonicalPath if a type's path shape ever changes.
    it.each(PREVIEWABLE_GDOC_TYPES)(
        "round-trips the canonical path of a %s back to its slug",
        (type) => {
            const slug = "a-slug"
            const path = getCanonicalPath(slug, type)
            expect(getSlugCandidatesForCanonicalPath(path)).toContain(slug)
        }
    )
})

describe(getSameSitePathFromUrl, () => {
    it.each([
        ["a production URL", `${PROD}/life-expectancy`],
        ["a trailing slash", `${PROD}/life-expectancy/`],
        ["several trailing slashes", `${PROD}/life-expectancy///`],
        ["a query string", `${PROD}/life-expectancy?tab=chart`],
        ["a fragment", `${PROD}/life-expectancy#a-heading`],
        ["both a query string and a fragment", `${PROD}/life-expectancy?a=b#c`],
        ["a root-relative path", "/life-expectancy"],
        ["the preview origin", `${PREVIEW}/life-expectancy`],
    ])("returns the path for %s", (_description, url) => {
        expect(getSameSitePathFromUrl(url, SAME_SITE_ORIGINS)).toBe(
            "/life-expectancy"
        )
    })

    it.each([
        ["/team/hannah-ritchie", `${PROD}/team/hannah-ritchie`],
        ["/profile/energy", `${PROD}/profile/energy`],
        ["/data-insights/an-insight", `${PROD}/data-insights/an-insight`],
        ["/sdgs/no-poverty", `${PROD}/sdgs/no-poverty`],
    ])("keeps the prefixed path %s intact", (expected, url) => {
        expect(getSameSitePathFromUrl(url, SAME_SITE_ORIGINS)).toBe(expected)
    })

    it.each([
        ["another host", "https://example.com/life-expectancy"],
        [
            "a subdomain we don't bake onto",
            "https://assets.ourworldindata.org/x",
        ],
        ["a grapher link", `${PROD}/grapher/life-expectancy`],
        ["a grapher link with a query string", `${PROD}/grapher/x?tab=map`],
        ["an explorer link", `${PROD}/explorers/poverty-explorer`],
        ["a gdoc link", "https://docs.google.com/document/d/abcd1234/edit"],
        ["an anchor-only link", "#a-heading"],
        ["a query-string-only link", "?tab=chart"],
        ["the site root", `${PROD}/`],
        ["the bare production origin", PROD],
        ["a mailto link", "mailto:info@ourworldindata.org"],
    ])("returns undefined for %s", (_description, url) => {
        expect(getSameSitePathFromUrl(url, SAME_SITE_ORIGINS)).toBeUndefined()
    })

    it("rejects the production origin when it isn't listed as same-site", () => {
        expect(
            getSameSitePathFromUrl(`${PROD}/life-expectancy`, [PREVIEW])
        ).toBeUndefined()
    })

    it("ignores an undefined origin in the same-site list", () => {
        expect(
            getSameSitePathFromUrl(`${PROD}/life-expectancy`, [PROD, undefined])
        ).toBe("/life-expectancy")
    })

    it("still resolves a root-relative path when no origins are same-site", () => {
        // a relative link has no origin to check, so it's ours by construction
        expect(getSameSitePathFromUrl("/life-expectancy", [])).toBe(
            "/life-expectancy"
        )
    })
})

describe("canonical path resolution end to end", () => {
    // The pairing the server relies on: narrow by slug candidates, then confirm
    // by recomputing the canonical path. This is what stops /sdgs resolving to
    // the article whose slug is sdgs/no-poverty.
    const resolve = (
        path: string,
        docs: { slug: string; type: OwidGdocType }[]
    ): { slug: string; type: OwidGdocType } | undefined => {
        const candidates = getSlugCandidatesForCanonicalPath(path)
        return docs
            .filter((doc) => candidates.includes(doc.slug))
            .find((doc) => getCanonicalPath(doc.slug, doc.type) === path)
    }

    const docs = [
        { slug: "sdgs", type: OwidGdocType.Article },
        { slug: "sdgs/no-poverty", type: OwidGdocType.Article },
        { slug: "hannah-ritchie", type: OwidGdocType.Author },
        { slug: "plastic-pollution", type: OwidGdocType.LinearTopicPage },
        { slug: "energy", type: OwidGdocType.Profile },
        { slug: "an-insight", type: OwidGdocType.DataInsight },
    ]

    it.each([
        ["/sdgs", "sdgs"],
        ["/sdgs/no-poverty", "sdgs/no-poverty"],
        ["/team/hannah-ritchie", "hannah-ritchie"],
        ["/plastic-pollution", "plastic-pollution"],
        ["/profile/energy", "energy"],
    ])("resolves %s to the document with slug %s", (path, expectedSlug) => {
        expect(resolve(path, docs)?.slug).toBe(expectedSlug)
    })

    it("does not resolve a data insight, which has no card metadata to show", () => {
        expect(resolve("/data-insights/an-insight", docs)).toBeUndefined()
    })

    it.each([
        // an author is not reachable at the top level
        "/hannah-ritchie",
        // nor a profile
        "/energy",
        // nor a data insight
        "/an-insight",
        // and a prefix alone names nothing
        "/team",
        "/nonexistent",
    ])("does not resolve %s", (path) => {
        expect(resolve(path, docs)).toBeUndefined()
    })
})
