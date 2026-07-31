import { expect, it, describe } from "vitest"

import { chunkParagraphs, chunkSentences, chunkWords } from "./chunk"

const CO2_TEXT = `The large growth in global CO₂ emissions has had a significant impact on the concentrations of CO₂ in Earth’s atmosphere. If we look at atmospheric concentrations over the past 2000 years (see the Data Quality and Measurement section in this entry for explanation on how we estimate historical emissions), we see that levels were fairly stable at 270-285 parts per million (ppm) until the 18th century. Since the Industrial Revolution, global CO₂ concentrations have been increasing rapidly.

However, CO₂ is not the only GHG we’re concerned about—emissions of nitrous oxide (N2O) and methane (CH4) have also been increasing rapidly through agricultural, energy, and industrial sources. Like CO₂, the atmospheric concentration of both of these gases has also been rising rapidly.

Has a global stabilization of CO₂ emissions over the last few years had an impact on global atmospheric concentrations? While it appears progress is being made on global emissions, atmospheric concentrations continue to rise, as shown below. Atmospheric concentrations have now broken the 400ppm threshold—considered its highest level in the last three million years. To begin to stabilise—or even reduce—atmospheric CO₂ concentrations, our emissions need to not only stabilise but also decrease significantly.`

const EMOJI_PARAGRAPHS = `Data visualization is powerful 😀. It helps people understand complex trends quickly.

Charts and graphs 📊 turn raw numbers into insights that anyone can grasp.`

// A UTF-16 code unit is a lone surrogate if it's part of a surrogate pair
// (i.e. an astral character like most emoji) that got split apart.
const hasLoneSurrogate = (text: string): boolean => {
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i)
        const isHighSurrogate = code >= 0xd800 && code <= 0xdbff
        const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff
        if (isHighSurrogate) {
            const next = text.charCodeAt(i + 1)
            if (!(next >= 0xdc00 && next <= 0xdfff)) return true
        } else if (isLowSurrogate) {
            const prev = text.charCodeAt(i - 1)
            if (!(prev >= 0xd800 && prev <= 0xdbff)) return true
        }
    }
    return false
}

describe(chunkWords, () => {
    it("keeps a word intact if it already fits", () => {
        expect(chunkWords("hello world", 20)).toEqual(["hello world"])
    })

    it("hard-splits a word that's too long to fit in any chunk", () => {
        const chunks = chunkWords("supercalifragilisticexpialidocious word", 10)
        expect(chunks).toEqual([
            "supercalif",
            "ragilistic",
            "expialidoc",
            "ious word",
        ])
    })

    it("doesn't break an emoji apart when hard-splitting a word", () => {
        // "😀" is a single character but two UTF-16 code units, so a naive
        // split by code unit could land in the middle of it.
        const chunks = chunkWords("aa😀bb", 3)

        expect(chunks).toEqual(["aa", "😀b", "b"])
        for (const c of chunks) {
            expect(hasLoneSurrogate(c)).toBe(false)
        }
    })

    it("keeps an emoji intact at a normal chunk length", () => {
        const chunks = chunkWords("I love data 😀 today, it's great.", 20)

        expect(chunks).toEqual(["I love data 😀", "today, it's great."])
        for (const c of chunks) {
            expect(hasLoneSurrogate(c)).toBe(false)
        }
    })
})

describe(chunkSentences, () => {
    it("doesn't break an emoji apart even under an extreme length limit", () => {
        const chunks = chunkSentences("I love data 😀. It's great.", 5)

        expect(chunks).toEqual([
            "I",
            "love",
            "data",
            "😀.",
            "It's",
            "great",
            ".",
        ])
        for (const c of chunks) {
            expect(hasLoneSurrogate(c)).toBe(false)
        }
    })

    it("keeps an emoji intact at a normal chunk length", () => {
        const chunks = chunkSentences(
            "I love data 😀. It's great. Charts help a lot.",
            30
        )

        expect(chunks).toEqual([
            "I love data 😀. It's great.",
            "Charts help a lot.",
        ])
        for (const c of chunks) {
            expect(hasLoneSurrogate(c)).toBe(false)
        }
    })
})

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

        const sentences = CO2_TEXT.split(/\n\n/).filter(Boolean)

        expect(chunks).toEqual([
            `${sentences[0]}\n\n${sentences[1]}`,
            `${sentences[2]}`,
        ])

        expect(chunks.length).toBe(2)
    })

    it("keeps emoji intact when splitting down to sentences", () => {
        const chunks = chunkParagraphs(EMOJI_PARAGRAPHS, 80)

        expect(chunks).toEqual([
            "Data visualization is powerful 😀.",
            "It helps people understand complex trends quickly.",
            "Charts and graphs 📊 turn raw numbers into insights that anyone can grasp.",
        ])
    })
})
