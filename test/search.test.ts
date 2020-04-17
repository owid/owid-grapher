#! /usr/bin/env yarn jest

import { chunkParagraphs } from "utils/search"
import { htmlToPlaintext } from "utils/htmlToString"

const CO2_TEXT = `The large growth in global CO₂ emissions has had a significant impact on the concentrations of CO₂ in Earth’s atmosphere. If we look at atmospheric concentrations over the past 2000 years (see the Data Quality and Measurement section in this entry for explanation on how we estimate historical emissions), we see that levels were fairly stable at 270-285 parts per million (ppm) until the 18th century. Since the Industrial Revolution, global CO₂ concentrations have been increasing rapidly.

However, CO₂ is not the only GHG we’re concerned about—emissions of nitrous oxide (N2O) and methane (CH4) have also been increasing rapidly through agricultural, energy, and industrial sources. Like CO₂, the atmospheric concentration of both of these gases has also been rising rapidly.

Has a global stabilization of CO₂ emissions over the last few years had an impact on global atmospheric concentrations? While it appears progress is being made on global emissions, atmospheric concentrations continue to rise, as shown below. Atmospheric concentrations have now broken the 400ppm threshold—considered its highest level in the last three million years. To begin to stabilise—or even reduce—atmospheric CO₂ concentrations, our emissions need to not only stabilise but also decrease significantly.`

describe(chunkParagraphs, () => {
    it("doesn't exceed the maximum length even if it has to compromise on chunk quality", () => {
        const chunks = chunkParagraphs(CO2_TEXT, 10)
        for (const c of chunks) {
            expect(c.length).toBeLessThanOrEqual(10)
        }
    })

    it("goes down to sentences if a paragraph doesn't fit in a chunk", () => {
        const chunks = chunkParagraphs(CO2_TEXT, 300)

        for (const c of chunks) {
            expect(c).toMatch(/\.$/)
        }
    })

    it("uses full paragraphs if it has enough room", () => {
        const chunks = chunkParagraphs(CO2_TEXT, 1000)

        expect(chunks.length).toBe(2)
    })
})

describe(htmlToPlaintext, () => {
    it("makes text with the right newlines", () => {
        const html = "<h2>HI</h2><p>cool</p><p>sounds good</p>"
        const text = htmlToPlaintext(html)

        expect(text).toEqual(`HI
cool

sounds good`)
    })
})
