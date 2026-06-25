import { describe, expect, it } from "vitest"
import {
    getAuthorTeamAnchorId,
    getAuthorTeamAnchorUrl,
    getLinkedDocumentUrl,
    isExternalUrl,
} from "./utils.js"
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

    it("preserves the fragment when rewriting profile links with ?entity=", () => {
        const url = getLinkedDocumentUrl(
            { slug: "air-pollution", type: OwidGdocType.Profile },
            "https://docs.google.com/document/d/abcd/edit?entity=France#my-heading",
            "https://ourworldindata.org"
        )
        expect(url).toBe(
            "https://ourworldindata.org/profile/air-pollution/france#my-heading"
        )
    })
})

describe(getAuthorTeamAnchorUrl, () => {
    it.each([
        ["Professor Max Roser", "/team#max-roser"],
        ["Angela Wenham", "/team#angela-wenham"],
        ["Dr. Esteban Ortiz-Ospina", "/team#esteban-ortiz-ospina"],
        ["Joe Hasell", "/team#joe-hasell"],
        ["Edouard Mathieu", "/team#edouard-mathieu"],
        ["Dr. Hannah Ritchie", "/team#hannah-ritchie"],
        ["Daniel Bachler", "/team#daniel-bachler"],
        ["Dr. Charlie Giattino", "/team#charlie-giattino"],
        ["Tuna Acisu", "/team#tuna-acisu"],
        ["Pablo Arriagada", "/team#pablo-arriagada"],
        ["Dr. Bastian Herre", "/team#bastian-herre"],
        ["Lucas Rodés-Guirao", "/team#lucas-rodes-guirao"],
        ["Dr. Bertha Rohenkohl", "/team#bertha-rohenkohl"],
        ["Dr. Pablo Rosado", "/team#pablo-rosado"],
        ["Dr. Veronika Samborska", "/team#veronika-samborska"],
        ["Dr. Fiona Spooner", "/team#fiona-spooner"],
        ["Matthieu Bergel", "/team#matthieu-bergel"],
        ["Marwa Boukarim", "/team#marwa-boukarim"],
        ["Marcel Gerber", "/team#marcel-gerber"],
        ["Dr. Bobbie Macdonald", "/team#bobbie-macdonald"],
        ["Sophia Mersmann", "/team#sophia-mersmann"],
        ["Martin Račák", "/team#martin-racak"],
        ["Ike Saunders", "/team#ike-saunders"],
        ["Mojmír Vinkler", "/team#mojmir-vinkler"],
        ["Antoinette Finnegan", "/team#antoinette-finnegan"],
        ["Natalie Reynolds-Garcia", "/team#natalie-reynolds-garcia"],
        ["Valerie Rogers Muigai, CGMA", "/team#valerie-rogers-muigai"],
        ["Simon van Teutem", "/team#simon-van-teutem"],
        ["Ernst-Jan van Woerden", "/team#ernst-jan-van-woerden"],
    ])("matches the /team anchor for %s", (name, expectedUrl) => {
        expect(getAuthorTeamAnchorUrl(name)).toBe(expectedUrl)
    })

    it("strips a trailing role before generating a team page anchor", () => {
        expect(
            getAuthorTeamAnchorUrl("Daniel Bachler (concept & modeling)")
        ).toBe("/team#daniel-bachler")
    })

    it("uses the provided base URL for archive-safe team page anchors", () => {
        expect(
            getAuthorTeamAnchorUrl(
                "Daniel Bachler",
                "https://ourworldindata.org"
            )
        ).toBe("https://ourworldindata.org/team#daniel-bachler")
    })
})

describe(getAuthorTeamAnchorId, () => {
    it("uses the same anchor for titled team page names and untitled author names", () => {
        expect(getAuthorTeamAnchorId("Dr. Bobbie Macdonald")).toBe(
            getAuthorTeamAnchorId("Bobbie Macdonald")
        )
    })

    it("uses the same anchor for credentialed team page names and plain author names", () => {
        expect(getAuthorTeamAnchorId("Valerie Rogers Muigai, CGMA")).toBe(
            getAuthorTeamAnchorId("Valerie Rogers Muigai")
        )
    })
})
