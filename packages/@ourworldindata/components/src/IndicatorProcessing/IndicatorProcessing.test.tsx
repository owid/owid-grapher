import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { IndicatorProcessing } from "./IndicatorProcessing.js"

const NOTES = "See [the source](https://example.org/method) for details."

describe("IndicatorProcessing click tracking", () => {
    it("renders no tracking attributes by default", () => {
        const html = renderToStaticMarkup(
            <IndicatorProcessing descriptionProcessing={NOTES} />
        )
        expect(html).not.toContain("data-track-note")
        expect(html).toContain('href="https://docs.owid.io/projects/etl/"')
        expect(html).toContain('href="https://example.org/method"')
    })

    it("tracks the pipeline link and the notes' links under trackNote", () => {
        const html = renderToStaticMarkup(
            <IndicatorProcessing
                descriptionProcessing={NOTES}
                trackNote="processing_link"
            />
        )
        expect(html.match(/data-track-note="processing_link"/g)).toHaveLength(2)
    })
})
