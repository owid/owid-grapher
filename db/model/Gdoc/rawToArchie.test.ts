import { expect, it } from "vitest"

import {
    EnrichedBlockCallout,
    EnrichedBlockVideo,
    RawBlockHomepageIntro,
    RawBlockTopicPageIntro,
} from "@ourworldindata/types"

import { enrichedBlockToRawBlock } from "./enrichedToRaw.js"
import { OwidRawGdocBlockToArchieMLString } from "./rawToArchie.js"

it("emits the callout icon", () => {
    const callout: EnrichedBlockCallout = {
        type: "callout",
        icon: "info",
        title: "A note",
        text: [],
        parseErrors: [],
    }
    const archie = OwidRawGdocBlockToArchieMLString(
        enrichedBlockToRawBlock(callout)
    )
    expect(archie).toContain("icon: info")
})

it("emits shouldAutoplay on videos", () => {
    const video: EnrichedBlockVideo = {
        type: "video",
        url: "https://ourworldindata.org/example.mp4",
        filename: "example.mp4",
        shouldLoop: true,
        shouldAutoplay: true,
        caption: [{ spanType: "span-simple-text", text: "A caption" }],
        parseErrors: [],
    }
    const archie = OwidRawGdocBlockToArchieMLString(
        enrichedBlockToRawBlock(video)
    )
    expect(archie).toContain("shouldAutoplay: true")
})

it("emits url before optional keys in topic-page-intro related topics", () => {
    const block: RawBlockTopicPageIntro = {
        type: "topic-page-intro",
        value: {
            content: [],
            "download-button": undefined,
            "related-topics": [
                { url: "https://ourworldindata.org/a", text: "Topic A" },
                { url: "https://ourworldindata.org/b" },
            ],
        },
    }
    const archie = OwidRawGdocBlockToArchieMLString(block)
    // url is the always-present key: ArchieML delimits array items by key
    // repetition, so a text-less topic must still start a new item.
    const lines = archie.split("\n").filter((l) => l.startsWith("url:"))
    expect(lines).toHaveLength(2)
    expect(archie.indexOf("url: https://ourworldindata.org/a")).toBeLessThan(
        archie.indexOf("text: Topic A")
    )
})

it("emits url before optional keys in homepage-intro featured work", () => {
    const block: RawBlockHomepageIntro = {
        type: "homepage-intro",
        value: {
            "featured-work": [
                { url: "https://ourworldindata.org/a" },
                {
                    url: "https://ourworldindata.org/b",
                    title: "B",
                },
            ],
        },
    }
    const archie = OwidRawGdocBlockToArchieMLString(block)
    expect(archie.indexOf("url: https://ourworldindata.org/b")).toBeLessThan(
        archie.indexOf("title: B")
    )
})

it("serializes stored component configs whose spans are flattened strings", () => {
    // posts_gdocs_components stores enriched blocks with spans flattened to
    // plain text; enrichedBlockToRawBlock must accept those too.
    const stored = {
        type: "text",
        value: "Just plain text",
        parseErrors: [],
    }
    expect(() => enrichedBlockToRawBlock(stored as never)).not.toThrow()
})
