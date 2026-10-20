import { describe, expect, it } from "vitest"

import {
    BlockSize,
    EnrichedBlockImage,
    OwidEnrichedGdocBlock,
    OwidGdoc,
    OwidGdocType,
} from "@ourworldindata/types"
import { getFeaturedImageFilename } from "./image.js"

const image = (
    filename: string,
    smallFilename?: string
): EnrichedBlockImage => ({
    type: "image",
    filename,
    smallFilename,
    size: BlockSize.Wide,
    hasOutline: true,
    parseErrors: [],
})

const text: OwidEnrichedGdocBlock = {
    type: "text",
    value: [{ spanType: "span-simple-text", text: "Some text" }],
    parseErrors: [],
}

const announcement = (body: OwidEnrichedGdocBlock[]): OwidGdoc =>
    ({
        content: {
            type: OwidGdocType.Announcement,
            title: "An announcement",
            excerpt: "",
            authors: [],
            body,
        },
    }) as unknown as OwidGdoc

// The featured image drives a page's og:image, i.e. the preview shown when
// the page is shared. Like data insights, announcements use the first image
// in their body.
describe("getFeaturedImageFilename for announcements", () => {
    it("uses the first image in the body", () => {
        const gdoc = announcement([
            text,
            image("chart.png"),
            image("other.png"),
        ])
        expect(getFeaturedImageFilename(gdoc)).toBe("chart.png")
    })

    it("prefers the small version of that image, like data insights", () => {
        const gdoc = announcement([image("chart.png", "chart-small.png")])
        expect(getFeaturedImageFilename(gdoc)).toBe("chart-small.png")
    })

    it("returns nothing when there is no image at all", () => {
        expect(getFeaturedImageFilename(announcement([text]))).toBeUndefined()
    })
})
