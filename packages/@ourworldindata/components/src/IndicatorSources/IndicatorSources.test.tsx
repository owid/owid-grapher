import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { IndicatorSources } from "./IndicatorSources.js"

const SOURCE = {
    label: "World Bank",
    description: "Compiled from [national accounts](https://example.org/na).",
    dataPublishedBy: "[World Bank](https://example.org/wb)",
    retrievedOn: "2026-01-01",
    retrievedFrom: "https://example.org/data",
}

describe("IndicatorSources click tracking", () => {
    it("renders no tracking attributes by default", () => {
        const html = renderToStaticMarkup(
            <IndicatorSources sources={[SOURCE]} />
        )
        expect(html).not.toContain("data-track-note")
    })

    it("tracks description and publisher links under descriptionTrackNote", () => {
        const html = renderToStaticMarkup(
            <IndicatorSources
                sources={[SOURCE]}
                descriptionTrackNote="source_link"
                retrievedFromTrackNote="retrieved_from"
            />
        )
        // the teaser duplicates the content inside <summary>, so count per copy
        const copies = (html.match(/class="source"/g) ?? []).length
        expect(copies).toBeGreaterThan(0)
        expect(html.match(/data-track-note="source_link"/g)).toHaveLength(
            2 * copies
        )
        expect(html.match(/data-track-note="retrieved_from"/g)).toHaveLength(
            copies
        )
    })
})
